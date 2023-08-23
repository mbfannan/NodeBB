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
const helpers_1 = __importDefault(require("./accounts/helpers"));
const privileges_1 = __importDefault(require("../privileges"));
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
const getUserDataByUID = (callerUid, uid) => __awaiter(void 0, void 0, void 0, function* () {
    if (!Number.isInteger(uid)) {
        throw new Error('[[error:no-user]]');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const canView = yield privileges_1.default.global.can('view:users', callerUid);
    if (!canView) {
        throw new Error('[[error:no-privileges]]');
    }
    if (!user_1.default) {
        throw new Error('[[error:no-privileges]]');
    }
    else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let userData = yield user_1.default.getUserData(uid);
        if (!userData) {
            throw new Error('[[error:no-user]]');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        userData = (yield user_1.default.hidePrivateData(userData, callerUid));
        return userData;
    }
});
function getUserDataByField(callerUid, field, fieldValue) {
    return __awaiter(this, void 0, void 0, function* () {
        let uid = null;
        if (field === 'uid') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            uid = !isNaN(parseInt(fieldValue, 10)) ? parseInt(fieldValue, 10) : null;
        }
        else if (field === 'username') {
            uid = (yield user_1.default.getUidByUsername(fieldValue));
        }
        else if (field === 'email') {
            uid = (yield user_1.default.getUidByEmail(fieldValue));
            if (uid) {
                const isPrivileged = yield user_1.default.isAdminOrGlobalMod(callerUid);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                const settings = yield user_1.default.getSettings(uid);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
                if (!isPrivileged && settings && !settings.showemail) {
                    uid = 0;
                }
            }
        }
        if (!uid) {
            return null;
        }
        return yield getUserDataByUID(callerUid, uid);
    });
}
function byType(type, req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!req.uid) {
            // Handle the error case, e.g., send an error response or throw an error.
            res.status(400).json({ error: 'Missing UID' });
            return;
        }
        const userData = yield getUserDataByField(req.uid, type, req.params[type]);
        if (!userData) {
            return next();
        }
        res.json(userData);
    });
}
function getUserByUID(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        yield byType('uid', req, res, next);
    });
}
const userController = {
    getCurrentUser: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
        if (!req.loggedIn) {
            res.status(401).json('not-authorized');
            return;
        }
        if (!req.uid) {
            res.status(400).json({ error: 'Missing UID' });
            return;
        }
        const userslug = yield user_1.default.getUserField(req.uid, 'userslug');
        // Assuming getUserDataByUserSlug returns a promise that resolves to UserData
        const userData = yield helpers_1.default.getUserDataByUserSlug(userslug, req.uid, req.query);
        res.json(userData);
    }),
    getUserByUID,
    getUserByUsername: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        yield byType('username', req, res, next);
    }),
    getUserByEmail: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        yield byType('email', req, res, next);
    }),
    getUserDataByField,
    getUserDataByUID,
    exportPosts: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const { uid } = res.locals;
        if (typeof uid !== 'string' && typeof uid !== 'number') {
            res.status(400).json({ error: 'Invalid UID' });
            return;
        }
        return new Promise((resolve, reject) => {
            sendExport(`${uid}_posts.csv`, 'text/csv', res, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }),
    exportUploads: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const { uid } = res.locals;
        if (typeof uid !== 'string' && typeof uid !== 'number') {
            res.status(400).json({ error: 'Invalid UID' });
            return;
        }
        return new Promise((resolve, reject) => {
            sendExport(`${uid}_uploads.csv`, 'application/zip', res, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }),
    exportProfile: (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const { uid } = res.locals;
        if (typeof uid !== 'string' && typeof uid !== 'number') {
            res.status(400).json({ error: 'Invalid UID' });
            return;
        }
        return new Promise((resolve, reject) => {
            sendExport(`${uid}_profile.json`, 'application/json', res, (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }),
};
exports.default = userController;
