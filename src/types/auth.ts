export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string;
    dateOfBirth?: string;
    photoUrl?: string;
    createdAt: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    name: string;
    email: string;
    phone: string;
    password: string;
}

export interface AuthResponse {
    user: User;
    token: string;
    refreshToken: string;
}
