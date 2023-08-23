import { Dictionary } from 'lodash';
import path from 'path';
import winston from 'winston';
import { Request, Response, NextFunction } from 'express';

import user from '../user';
import accountHelpers from './accounts/helpers';
import privileges from '../privileges';


interface CustomRequest extends Request {
    loggedIn?: boolean;
    uid?: number;
}
interface UserData {
    [key: string]: string;
}
interface HiddenUserData {
    id: number;
    password_hash: string;
}
type UserSettings = {
    uid: number | string;
    showemail?: boolean;
    showfullname?: boolean;
    openOutgoingLinksInNewTab?: boolean;
    dailyDigestFreq?: 'off' | string;
    usePagination?: boolean;
    topicsPerPage?: number;
    postsPerPage?: number;
    userLang?: string;
    acpLang?: string;
    topicPostSort?: string;
    categoryTopicSort?: string;
    followTopicsOnCreate?: boolean;
    followTopicsOnReply?: boolean;
    upvoteNotifFreq?: string;
    restrictChat?: boolean;
    topicSearchEnabled?: boolean;
    updateUrlWithPostIndex?: boolean;
    bootswatchSkin?: string;
    homePageRoute?: string;
    scrollToMyPost?: boolean;
    categoryWatchState?: string;
    [key: string]: any;
};
function sendExport(filename: string, type: string, res: Response, next: NextFunction): void {
    winston.warn('[users/export] Access via page API is deprecated, use GET /api/v3/users/:uid/exports/:type instead.');
    try {
        res.sendFile(filename, {
            root: path.join(__dirname, '../../build/export'),
            headers: {
                'Content-Type': type,
                'Content-Disposition': `attachment; filename=${filename}`,
            },
        });
    } catch (err) {
        if (err instanceof Error) {
            if (err.message === 'ENOENT') {
                res.locals.isAPI = false;
                next();
            }
        } else {
            next(err as Error);
        }
    }
}
const getUserDataByUID = async (callerUid: number, uid: number): Promise<UserData> => {
    if (!Number.isInteger(uid)) {
        throw new Error('[[error:no-user]]');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const canView = await privileges.global.can('view:users', callerUid) as boolean;
    if (!canView) {
        throw new Error('[[error:no-privileges]]');
    }
    if (!user) {
        throw new Error('[[error:no-privileges]]');
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        let userData: UserData = await user.getUserData(uid) as UserData;
        if (!userData) {
            throw new Error('[[error:no-user]]');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        userData = await user.hidePrivateData(userData, callerUid) as UserData;
        return userData;
    }
};
async function getUserDataByField(callerUid: number, field: string, fieldValue: string): Promise<UserData | null> {
    let uid: number | null = null;
    if (field === 'uid') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        uid = !isNaN(parseInt(fieldValue, 10)) ? parseInt(fieldValue, 10) : null;
    } else if (field === 'username') {
        uid = await user.getUidByUsername(fieldValue) as number;
    } else if (field === 'email') {
        uid = await user.getUidByEmail(fieldValue) as number;
        if (uid) {
            const isPrivileged = await user.isAdminOrGlobalMod(callerUid) as string[];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const settings = await user.getSettings(uid) as UserSettings;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            if (!isPrivileged && settings && !settings.showemail) {
                uid = 0;
            }
        }
    }
    if (!uid) {
        return null;
    }
    return await getUserDataByUID(callerUid, uid);
}
async function byType(type: string, req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    if (!req.uid) {
        // Handle the error case, e.g., send an error response or throw an error.
        res.status(400).json({ error: 'Missing UID' });
        return;
    }

    const userData = await getUserDataByField(req.uid, type, req.params[type]);
    if (!userData) {
        return next();
    }
    res.json(userData);
}
async function getUserByUID(req: CustomRequest, res: Response, next: NextFunction): Promise<void> {
    await byType('uid', req, res, next);
}
const userController = {
    getCurrentUser: async (req: CustomRequest, res: Response): Promise<void> => {
        if (!req.loggedIn) {
            res.status(401).json('not-authorized');
            return;
        }
        if (!req.uid) {
            res.status(400).json({ error: 'Missing UID' });
            return;
        }
        const userslug = await (user as { getUserField(uid: number | string, field: string): Promise<string | null> }).getUserField(req.uid, 'userslug');
        // Assuming getUserDataByUserSlug returns a promise that resolves to UserData
        const userData = await accountHelpers.getUserDataByUserSlug(userslug, req.uid, req.query) as UserData;
        res.json(userData);
    },
    getUserByUID,
    getUserByUsername: async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
        await byType('username', req, res, next);
    },

    getUserByEmail: async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
        await byType('email', req, res, next);
    },
    getUserDataByField,
    getUserDataByUID,
    exportPosts: async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
        const { uid } = res.locals;
        if (typeof uid !== 'string' && typeof uid !== 'number') {
            res.status(400).json({ error: 'Invalid UID' });
            return;
        }
        return new Promise<void>((resolve, reject) => {
            sendExport(`${uid}_posts.csv`, 'text/csv', res, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    exportUploads: async (req: CustomRequest, res: Response<object>, next: NextFunction): Promise<void> => {
        const { uid } = res.locals;
        if (typeof uid !== 'string' && typeof uid !== 'number') {
            res.status(400).json({ error: 'Invalid UID' });
            return;
        }
        return new Promise<void>((resolve, reject) => {
            sendExport(`${uid}_uploads.csv`, 'application/zip', res, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
    exportProfile: async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
        const { uid } = res.locals;
        if (typeof uid !== 'string' && typeof uid !== 'number') {
            res.status(400).json({ error: 'Invalid UID' });
            return;
        }
        return new Promise<void>((resolve, reject) => {
            sendExport(`${uid}_profile.json`, 'application/json', res, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },
};





export default userController;


