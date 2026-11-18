/**
 * Storage boundary used by HTTP and Socket.IO. Route handlers depend on this
 * contract rather than a database driver; the current implementation delegates
 * to the synchronous SQLite store. A PostgreSQL implementation can replace the
 * adapter at startup while preserving the route-facing API.
 */
const sqliteStore = require('./roomStore');

const ROOM_REPOSITORY_METHODS = Object.freeze([
  'saveRoom', 'getRoomById', 'resolveActualRoomId', 'roomExists', 'isRoomExpired',
  'cleanupExpiredRooms', 'addProductToRoom', 'removeProductFromRoom',
  'addOrUpdateParticipant', 'updateParticipantName', 'getParticipant',
  'verifyParticipantToken', 'getRoomCreatorToken', 'verifyRoomCreatorToken',
  'recordVote', 'getProductVotes', 'addComment', 'getProductComments',
  'addRoomMessage', 'getRoomMessages', 'setRoomFinalChoice', 'clearRooms',
]);

class RoomRepository {
  constructor(adapter = sqliteStore) {
    this.adapter = adapter;
  }

  static get methods() { return ROOM_REPOSITORY_METHODS; }
}

class SqliteRoomRepository extends RoomRepository {
  constructor(adapter = sqliteStore) { super(adapter); }
}

for (const method of ROOM_REPOSITORY_METHODS) {
  Object.defineProperty(RoomRepository.prototype, method, {
    configurable: false,
    value(...args) {
      if (typeof this.adapter[method] !== 'function') throw new Error(`Repository adapter does not implement ${method}`);
      return this.adapter[method](...args);
    },
  });
}

const repository = new SqliteRoomRepository();
for (const method of ROOM_REPOSITORY_METHODS) Object.defineProperty(repository, method, { enumerable: true, value: repository[method].bind(repository) });

module.exports = { RoomRepository, SqliteRoomRepository, repository, ...repository };
