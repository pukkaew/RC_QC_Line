// LINE API configuration
module.exports = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    
    // Rich menu IDs
    richMenuId: process.env.LINE_RICH_MENU_ID,
    
    // Message types
    messageTypes: {
      text: 'text',
      image: 'image',
      quickReply: 'quickReply',
      flexMessage: 'flex'
    },
    
    // Quick reply options
    quickReplyOptions: {
      enterLot: 'กรุณาระบุเลข Lot',
      viewImages: 'ต้องการดูรูปภาพ'
    },
    
    // User states in conversation flow
    userStates: {
      idle: 'idle',
      waitingForLot: 'waitingForLot',
      waitingForDate: 'waitingForDate',
      waitingForImages: 'waitingForImages'
    },
    
    // User actions
    userActions: {
      upload: 'upload',
      view: 'view'
    }
  };