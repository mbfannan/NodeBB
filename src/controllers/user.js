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
const path_1 = __importDefault(require("path"));
const winston_1 = __importDefault(require("winston"));
const user_1 = __importDefault(require("../user"));
const privileges_1 = __importDefault(require("../privileges"));
const helpers_1 = __importDefault(require("./accounts/helpers"));
const userController = module.exports;
userController.getCurrentUser = function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.loggedIn) {
            return res.status(401).json('not-authorized');
        }
        const userslug = yield user_1.default.getUserField(req.uid, 'userslug');
        const userData = yield helpers_1.default.getUserDataByUserSlug(userslug, req.uid, req.query);
        res.json(userData);
    });
};
userController.getUserByUID = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield byType('uid', req, res, next);
    });
};
userController.getUserByUsername = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield byType('username', req, res, next);
    });
};
userController.getUserByEmail = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield byType('email', req, res, next);
    });
};
function byType(type, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const userData = yield userController.getUserDataByField(req.uid, type, req.params[type]);
        if (!userData) {
            return next();
        }
        res.json(userData);
    });
}
userController.getUserDataByField = function (callerUid, field, fieldValue) {
    return __awaiter(this, void 0, void 0, function* () {
        let uid = null;
        if (field === 'uid') {
            uid = fieldValue;
        }
        else if (field === 'username') {
            uid = yield user_1.default.getUidByUsername(fieldValue);
        }
        else if (field === 'email') {
            uid = yield user_1.default.getUidByEmail(fieldValue);
            if (uid) {
                const isPrivileged = yield user_1.default.isAdminOrGlobalMod(callerUid);
                const settings = yield user_1.default.getSettings(uid);
                if (!isPrivileged && (settings && !settings.showemail)) {
                    uid = 0;
                }
            }
        }
        if (!uid) {
            return null;
        }
        return yield userController.getUserDataByUID(callerUid, uid);
    });
};
userController.getUserDataByUID = function (callerUid, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!parseInt(uid, 10)) {
            throw new Error('[[error:no-user]]');
        }
        const canView = yield privileges_1.default.global.can('view:users', callerUid);
        if (!canView) {
            throw new Error('[[error:no-privileges]]');
        }
        let userData = yield user_1.default.getUserData(uid);
        if (!userData) {
            throw new Error('[[error:no-user]]');
        }
        userData = yield user_1.default.hidePrivateData(userData, callerUid);
        return userData;
    });
};
userController.exportPosts = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        sendExport(`${res.locals.uid}_posts.csv`, 'text/csv', res, next);
    });
};
userController.exportUploads = function (req, res, next) {
    sendExport(`${res.locals.uid}_uploads.zip`, 'application/zip', res, next);
};
userController.exportProfile = function (req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        sendExport(`${res.locals.uid}_profile.json`, 'application/json', res, next);
    });
};
function sendExport(filename, type, res, next) {
    winston_1.default.warn('[users/export] Access via page API is deprecated, use GET /api/v3/users/:uid/exports/:type instead.');
    try {
        res.sendFile(filename, {
            root: path_1.default.join(__dirname, '../../build/export'),
            headers: {
                'Content-Type': type,
                'Content-Disposition': `attachment; filename=${filename}`,
            },
        });
    }
    catch (err) {
        if (err instanceof Error) {
            if (err.message === 'ENOENT') {
                res.locals.isAPI = false;
                next();
            }
        }
        else {
            next(err);
        }
    }
}
require('../promisify')(userController, [
    'getCurrentUser', 'getUserByUID', 'getUserByUsername', 'getUserByEmail',
    'exportPosts', 'exportUploads', 'exportProfile',
]);
