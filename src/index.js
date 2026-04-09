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
const express_1 = __importDefault(require("express"));
const db_1 = require("./db");
const seed_1 = require("./seed");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use(express_1.default.json());
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting application...');
        // Connect to DB
        yield (0, db_1.connectDB)();
        // Run seeding
        try {
            yield (0, seed_1.runSeed)();
        }
        catch (error) {
            console.error('Seeding during startup failed:', error);
            // Continue anyway, maybe DB is already seeded but count check failed or network issue
        }
        // Basic health check endpoint
        app.get('/health', (req, res) => {
            res.json({ status: 'ok' });
        });
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    });
}
start();
