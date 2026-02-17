const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');
const { Event } = require('../models');
const { protect } = require('../middleware/auth');
const ExcelJS = require('exceljs');

// All sensor routes require authentication
router.use(protect);

// ===================================================================
// @route   GET /api/sensors/latest
// @desc    Get latest sensor reading
// @access  Private
// ===================================================================
router.get('/latest', async (req, res) => {
  try {
    const latest = await Reading.findOne().sort({ received_at: -1 });

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: 'No readings available yet',
      });
    }

    res.json({
      success: true,
      data: latest,
    });

  } catch (error) {
    console.error('Error fetching latest reading:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   GET /api/sensors/24h
// @desc    Get last 24 hours of data
// @access  Private
// ===================================================================
router.get('/24h', async (req, res) => {
  try {
    const readings = await Reading.getLast24Hours();

    res.json({
      success: true,
      count: readings.length,
      data: readings,
    });

  } catch (error) {
    console.error('Error fetching 24h data:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   GET /api/sensors/date/:date
// @desc    Get data for a specific date (YYYY-MM-DD)
// @access  Private
// ===================================================================
router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    const readings = await Reading.getByDate(date);

    res.json({
      success: true,
      date,
      count: readings.length,
      data: readings,
    });

  } catch (error) {
    console.error('Error fetching date data:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   GET /api/sensors/range
// @desc    Get data for a date range
// @access  Private
// ===================================================================
router.get('/range', async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        error: 'Start and end dates required (YYYY-MM-DD)',
      });
    }

    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);

    const readings = await Reading.find({
      received_at: { $gte: startDate, $lte: endDate }
    }).sort({ received_at: 1 }).lean();

    res.json({
      success: true,
      start,
      end,
      count: readings.length,
      data: readings,
    });

  } catch (error) {
    console.error('Error fetching range data:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   GET /api/sensors/export/excel
// @desc    Export data as Excel file (date query param)
// @access  Private
// ===================================================================
router.get('/export/excel', async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter required (YYYY-MM-DD)',
      });
    }

    const readings = await Reading.getByDate(date);

    if (readings.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No data found for ${date}`,
      });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sensor Data');

    // Headers
    worksheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 20 },
      { header: 'Temperature (°C)', key: 'temp', width: 18 },
      { header: 'Humidity (%)', key: 'hum', width: 15 },
      { header: 'Soil 1 (%)', key: 'soil1', width: 12 },
      { header: 'Soil 2 (%)', key: 'soil2', width: 12 },
      { header: 'Nitrogen (mg/kg)', key: 'n', width: 18 },
      { header: 'Phosphorus (mg/kg)', key: 'p', width: 18 },
      { header: 'Potassium (mg/kg)', key: 'k', width: 18 },
      { header: 'Water Pump', key: 'pump_water', width: 12 },
      { header: 'Nutrient Pump', key: 'pump_nutrient', width: 15 },
      { header: 'Exhaust Fan', key: 'fan_exhaust', width: 12 },
      { header: 'Peltier PWM', key: 'peltier', width: 12 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' }
    };

    // Add data rows
    readings.forEach(r => {
      worksheet.addRow({
        timestamp: r.received_at,
        temp: r.temp ? r.temp.toFixed(1) : 'N/A',
        hum: r.hum ? r.hum.toFixed(1) : 'N/A',
        soil1: r.soil1 ? r.soil1.toFixed(1) : 'N/A',
        soil2: r.soil2 ? r.soil2.toFixed(1) : 'N/A',
        n: r.npk && r.npk.ok ? r.npk.n : 'N/A',
        p: r.npk && r.npk.ok ? r.npk.p : 'N/A',
        k: r.npk && r.npk.ok ? r.npk.k : 'N/A',
        pump_water: r.actuators && r.actuators.pump_water ? 'ON' : 'OFF',
        pump_nutrient: r.actuators && r.actuators.pump_nutrient ? 'ON' : 'OFF',
        fan_exhaust: r.actuators && r.actuators.fan_exhaust ? 'ON' : 'OFF',
        peltier: r.actuators && r.actuators.peltier_pwm ? r.actuators.peltier_pwm : 0,
      });
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=greenhouse_data_${date}.xlsx`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Excel file',
    });
  }
});

// ===================================================================
// @route   GET /api/sensors/events/24h
// @desc    Get automation events for last 24 hours
// @access  Private
// ===================================================================
router.get('/events/24h', async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const events = await Event.find({
      received_at: { $gte: twentyFourHoursAgo }
    }).sort({ received_at: -1 }).lean();

    res.json({
      success: true,
      count: events.length,
      data: events,
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

module.exports = router;
