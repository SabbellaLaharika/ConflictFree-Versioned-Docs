"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.getDB = getDB;
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative_docs';
const dbName = 'collaborative_docs';
let client;
let db;
function connectDB() {
    return __awaiter(this, void 0, void 0, function* () {
        if (db)
            return db;
        try {
            client = yield mongodb_1.MongoClient.connect(url);
            db = client.db(dbName);
            console.log('Connected to MongoDB');
            return db;
        }
        catch (error) {
            console.error('Failed to connect to MongoDB', error);
            process.exit(1);
        }
    });
}
function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
}
