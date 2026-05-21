const registerJoin         = require('./join');
const registerChat         = require('./chat');
const registerDestinations = require('./destinations');
const registerAvailability = require('./availability');
const registerDatevote     = require('./datevote');
const registerActivities   = require('./activities');
const registerExpenses     = require('./expenses');
const registerGroup        = require('./group');

// This function is called once when the server starts.
// It listens for new WebSocket connections and registers all event handlers
// for each connected client. Every time a user opens the app, a new socket
// connection is created and all handlers are attached to it.
module.exports = function registerAllHandlers(io, sessions) {
  io.on('connection', socket => {
    // The user data was verified and attached to socket.user by socketAuth middleware
    const { _id: userId, username, color } = socket.user;

    // ctx bundles everything the handlers need — we pass it instead of
    // repeating the same parameters in every single handler file
    const ctx = { io, sessions, userId, username, color };

    // Register handlers grouped by feature area
    registerJoin(socket, ctx);           // joining/leaving rooms, disconnect
    registerChat(socket, ctx);           // chat messages, typing indicator
    registerDestinations(socket, ctx);   // suggest, vote, approve, edit destinations
    registerAvailability(socket, ctx);   // mark unavailable days, compute date ranges
    registerDatevote(socket, ctx);       // vote on date windows, confirm trip date
    registerActivities(socket, ctx);     // add/edit/remove itinerary activities
    registerExpenses(socket, ctx);       // add/edit/remove shared expenses
    registerGroup(socket, ctx);          // leave/delete group
  });
};
