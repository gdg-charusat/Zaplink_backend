import jwt from 'jsonwebtoken'

const getAccessTokenSecret = (): string => {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
        throw new Error(
            'ACCESS_TOKEN_SECRET environment variable is not set. ' +
            'Please set it in your .env file to a strong, random secret.'
        );
    }
    return secret;
};

const getRefreshTokenSecret = (): string => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret) {
        throw new Error(
            'REFRESH_TOKEN_SECRET environment variable is not set. ' +
            'Please set it in your .env file to a strong, random secret.'
        );
    }
    return secret;
};

const generateAccessToken = (userId: string): string => {
    const expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || "1d";

    return jwt.sign(
        { userId },
        getAccessTokenSecret(),
        { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    )
}

const generateRefreshToken = (userId: string): string => {
    const expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

    return jwt.sign(
        { userId },
        getRefreshTokenSecret(),
        { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] }
    )
}

export { generateAccessToken, generateRefreshToken };
