// Builder for date picker flex messages
const dateFormatter = require('../utils/DateFormatter');

class DatePickerBuilder {
  constructor() {
    this.dateFormatter = dateFormatter;
  }

  // Build a date picker flex message
  buildDatePickerFlexMessage(lotNumber, action, dates = null) {
    // If dates are not provided, use the last 7 days
    const dateOptions = dates || this.dateFormatter.getPrevious7Days();
    
    // Create date selection buttons
    const dateButtons = dateOptions.map(dateObj => {
      return {
        type: "button",
        style: "primary",
        action: {
          type: "postback",
          label: dateObj.display,
          data: `action=${action}&lot=${lotNumber}&date=${dateObj.date}`,
          displayText: `เลือกวันที่ ${dateObj.display}`
        },
        margin: "sm",
        height: "sm"
      };
    });
    
    // Create the flex message
    const flexMessage = {
      type: "flex",
      altText: "เลือกวันที่",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `เลือกวันที่สำหรับ Lot: ${lotNumber}`,
              weight: "bold",
              size: "lg",
              wrap: true
            },
            {
              type: "text",
              text: "กรุณาเลือกวันที่ที่ต้องการ",
              size: "sm",
              color: "#999999",
              margin: "md"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: dateButtons
            }
          ]
        }
      }
    };
    
    return flexMessage;
  }

  // Build a date range picker flex message for custom date selection
  buildDateRangePickerFlexMessage(lotNumber, action) {
    // Get current month's dates
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const dateRange = this.dateFormatter.getDateRange(startOfMonth, endOfMonth);
    
    // Create a calendar-like layout with dates
    const weeks = [];
    let currentWeek = [];
    
    // Add empty slots for days before the first day of the month
    const firstDayOfWeek = startOfMonth.getDay(); // 0 for Sunday, 1 for Monday, etc.
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({
        type: "text",
        text: " ",
        flex: 1,
        align: "center"
      });
    }
    
    // Add dates
    dateRange.forEach((dateObj, index) => {
      const dayOfWeek = new Date(dateObj.date).getDay();
      
      // Create date button
      const dateButton = {
        type: "button",
        style: dateObj.date === this.dateFormatter.getCurrentDate() ? "primary" : "secondary",
        action: {
          type: "postback",
          label: dateObj.date.split('-')[2], // Only the day part
          data: `action=${action}&lot=${lotNumber}&date=${dateObj.date}`,
          displayText: `เลือกวันที่ ${dateObj.display}`
        },
        flex: 1,
        height: "sm",
        margin: "xs"
      };
      
      currentWeek.push(dateButton);
      
      // Start a new week on Saturday or when at the end
      if (dayOfWeek === 6 || index === dateRange.length - 1) {
        // Fill in any remaining slots in the week
        while (currentWeek.length < 7) {
          currentWeek.push({
            type: "text",
            text: " ",
            flex: 1,
            align: "center"
          });
        }
        
        weeks.push({
          type: "box",
          layout: "horizontal",
          contents: currentWeek,
          margin: "xs"
        });
        
        currentWeek = [];
      }
    });
    
    // Create the calendar flex message
    const flexMessage = {
      type: "flex",
      altText: "ปฏิทินเลือกวันที่",
      contents: {
        type: "bubble",
        size: "mega",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `ปฏิทินสำหรับ Lot: ${lotNumber}`,
              weight: "bold",
              size: "lg",
              wrap: true
            },
            {
              type: "text",
              text: this.dateFormatter.formatThaiDate(today).split(' ')[1], // Just the month name
              size: "md",
              color: "#999999",
              margin: "md"
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "lg",
              contents: [
                { type: "text", text: "อา", flex: 1, align: "center", weight: "bold" },
                { type: "text", text: "จ", flex: 1, align: "center", weight: "bold" },
                { type: "text", text: "อ", flex: 1, align: "center", weight: "bold" },
                { type: "text", text: "พ", flex: 1, align: "center", weight: "bold" },
                { type: "text", text: "พฤ", flex: 1, align: "center", weight: "bold" },
                { type: "text", text: "ศ", flex: 1, align: "center", weight: "bold" },
                { type: "text", text: "ส", flex: 1, align: "center", weight: "bold" }
              ]
            },
            {
              type: "box",
              layout: "vertical",
              margin: "sm",
              spacing: "xs",
              contents: weeks
            }
          ]
        }
      }
    };
    
    return flexMessage;
  }
}

module.exports = new DatePickerBuilder();