// Date formatting utility
const moment = require('moment');

class DateFormatter {
  constructor() {
    // Set default locale to Thai
    moment.locale('th');
  }

  // Format date to human-readable Thai format
  formatThaiDate(date) {
    const momentDate = moment(date);
    return momentDate.format('D MMMM YYYY');
  }

  // Format date to ISO format
  formatISODate(date) {
    const momentDate = moment(date);
    return momentDate.format('YYYY-MM-DD');
  }

  // Format date to display in LINE messages
  formatDisplayDate(date) {
    const momentDate = moment(date);
    return momentDate.format('DD/MM/YYYY');
  }

  // Get current date in ISO format
  getCurrentDate() {
    return moment().format('YYYY-MM-DD');
  }

  // Get current date and time in ISO format
  getCurrentDateTime() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  }

  // Parse date string to Date object
  parseDate(dateString) {
    return moment(dateString).toDate();
  }

  // Check if a date is valid
  isValidDate(dateString) {
    return moment(dateString).isValid();
  }

  // Get previous 7 days from today
  getPrevious7Days() {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = moment().subtract(i, 'days');
      dates.push({
        date: date.format('YYYY-MM-DD'),
        display: date.format('DD/MM/YYYY'),
        thai: date.format('D MMMM YYYY')
      });
    }
    return dates;
  }

  // Get date range in array (from startDate to endDate)
  getDateRange(startDate, endDate) {
    const start = moment(startDate);
    const end = moment(endDate);
    const range = [];

    for (let date = start; date.isSameOrBefore(end); date.add(1, 'days')) {
      range.push({
        date: date.format('YYYY-MM-DD'),
        display: date.format('DD/MM/YYYY'),
        thai: date.format('D MMMM YYYY')
      });
    }

    return range;
  }
}

module.exports = new DateFormatter();