# 🔐 Complete Google OAuth Setup Guide - MoneyMata

## 📋 Table of Contents
1. [Google Cloud Console Setup](#1-google-cloud-console-setup)
2. [Environment Variables](#2-environment-variables)
3. [Backend Implementation](#3-backend-implementation)
4. [Frontend Implementation](#4-frontend-implementation)
5. [Complete Flow Explanation](#5-complete-flow-explanation)
6. [Testing](#6-testing)

---

## 1. Google Cloud Console Setup

### Steps to Configure Google OAuth:

#### 1.1 Create/Select a Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown (top left corner)
3. Click **"New Project"** or select an existing project
4. Name your project (e.g., "MoneyMata")
5. Click **"Create"**

#### 1.2 Enable Required APIs

1. Navigate to **APIs & Services** → **Library**
2. Search for **"Google+ API"** or **"People API"**
3. Click on it and press **"Enable"**

#### 1.3 Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **"External"** (allows any Google account to sign in)
3. Click **"Create"**

**Fill in the required information:**

| Field | Value |
|-------|-------|
| App name | MoneyMata |
| User support email | Your email address |
| App logo | (Optional) Upload your logo |
| App domain | (Optional for dev) |
| Authorized domains | (Optional for dev) |
| Developer contact email | Your email address |

4. Click **"Save and Continue"**

**Scopes:**
5. Click **"Add or Remove Scopes"**
6. Add these scopes:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
7. Click **"Update"** → **"Save and Continue"**

**Test Users (for development):**
8. Click **"Add Users"**
9. Add your test email addresses
10. Click **"Save and Continue"**

#### 1.4 Create OAuth 2.0 Client ID

1. Go to **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** → **"OAuth 2.0 Client ID"**
3. Select **"Web application"** as Application type
4. Name it: "MoneyMata Web Client"

**Configure Authorized URIs:**

**Authorized JavaScript origins:**
```
http://localhost:3000
```

**Authorized redirect URIs:**
```
http://localhost:3000
http://localhost:3000/login
http://localhost:3000/register
```

5. Click **"Create"**

#### 1.5 Copy Your Credentials

After creation, you'll see a modal with:
- **Client ID**: `178257577138-xxxxxxxxxx.apps.googleusercontent.com`
- **Client Secret**: `GOCSPX-xxxxxxxxxxxxx`

**Important:**
- Copy the **Client ID** - you'll need it for frontend
- Copy the **Client Secret** - save it securely (though not needed for this implementation)

---

## 2. Environment Variables

### 2.1 Frontend Environment Variables

**File:** `frontend/.env.local`

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Google OAuth Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here

# Optional: Keep for reference
# CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx (Never commit real secrets!)
# CLIENT_ID=your_client_id_here
```

**Important Notes:**
- `NEXT_PUBLIC_` prefix makes the variable accessible in the browser
- **Never** put the Client Secret in frontend environment variables
- Only the Client ID is needed for client-side OAuth

### 2.2 Backend Environment Variables

**File:** `backend/.env`

For this implementation, **NO Google credentials are needed in the backend** because we're using a **client-side OAuth flow**. The frontend handles authentication with Google directly.

Your existing backend `.env` remains the same:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb+srv://...

# JWT Secrets
JWT_SECRET=moneymata-super-secret-jwt-key-for-development-only-min-32-chars
JWT_REFRESH_SECRET=moneymata-refresh-token-secret-for-development-only-min-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

---

## 3. Backend Implementation

### 3.1 User Model

**File:** `backend/src/models/User.ts`

```typescript
import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password?: string;      // Optional: Not required for OAuth users
  fullName: string;
  googleId?: string;      // Store Google's unique user identifier
  avatar?: string;        // Profile picture URL from Google
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false // Don't return password by default
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters']
    },
    googleId: {
      type: String,
      sparse: true,    // Allows multiple null values
      unique: true     // But ensures uniqueness when set
    },
    avatar: {
      type: String
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
```

**Key Points:**
- `googleId`: Stores Google's unique user identifier (the `sub` field from Google's API)
- `sparse: true`: Allows multiple users without a Google ID (regular email/password users)
- `unique: true`: Ensures no duplicate Google accounts can be created
- `password`: Optional field because OAuth users don't need a password

### 3.2 Auth Controller - Google OAuth Handler

**File:** `backend/src/controllers/authController.ts`

```typescript
/**
 * Google OAuth login/register
 * POST /api/auth/google
 */
export const googleAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { googleId, email, fullName, avatar } = req.body;

    // Validate required fields
    if (!googleId || !email) {
      throw new ValidationError('Google ID and email are required');
    }

    // Find existing user by Google ID or email
    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }]
    });

    if (!user) {
      // Scenario 1: New user - Create account
      user = await User.create({
        email: email.toLowerCase(),
        fullName: fullName || email.split('@')[0],
        googleId,
        avatar,
        isEmailVerified: true,  // Google emails are already verified
        password: Math.random().toString(36)  // Random password (not used)
      });

      // Create free tier subscription for new user
      await UserSubscription.create({
        userId: user._id,
        tier: 'free',
        receiptsScannedThisMonth: 0,
        monthResetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      });

      // Send welcome email to new Google users
      await emailService.sendWelcomeEmail(user.email, user.fullName);

    } else if (!user.googleId) {
      // Scenario 2: Existing email/password user linking Google account
      user.googleId = googleId;
      user.isEmailVerified = true;
      if (avatar && !user.avatar) {
        user.avatar = avatar;
      }
      await user.save();
    }
    // Scenario 3: User already exists with Google ID - just login

    // Get user subscription tier
    const subscription = await UserSubscription.findOne({ userId: user._id });
    const tier = subscription?.tier || 'free';

    // Generate JWT tokens
    const { accessToken, refreshToken } = await generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      tier
    });

    // Store refresh token in database
    const hashedRefreshToken = RefreshToken.hashToken(refreshToken);
    await RefreshToken.create({
      userId: user._id,
      token: hashedRefreshToken,
      expiresAt: getRefreshTokenExpiration()
    });

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    });

    // Return user data and access token
    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          avatar: user.avatar,
          tier
        },
        accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};
```

**Three Scenarios Handled:**

1. **New User**:
   - Create new user account
   - Create free subscription
   - Send welcome email
   - Return JWT tokens

2. **Existing User (no Google ID)**:
   - Link Google account to existing email/password account
   - Update `googleId` and `avatar`
   - Mark email as verified
   - Return JWT tokens

3. **Existing Google User**:
   - Simply log them in
   - Return JWT tokens

### 3.3 Auth Routes

**File:** `backend/src/routes/authRoutes.ts`

```typescript
import express from 'express';
import {
  register,
  login,
  logout,
  refresh,
  getCurrentUser,
  verifyEmail,
  resendVerification,
  googleAuth,  // Import the Google auth handler
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

// Google OAuth route
router.post('/google', googleAuth);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

export default router;
```

**Endpoint:** `POST /api/auth/google`

**Request Body:**
```json
{
  "googleId": "1234567890",
  "email": "user@gmail.com",
  "fullName": "John Doe",
  "avatar": "https://lh3.googleusercontent.com/..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Google authentication successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@gmail.com",
      "fullName": "John Doe",
      "avatar": "https://lh3.googleusercontent.com/...",
      "tier": "free"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 4. Frontend Implementation

### 4.1 Install Required Package

**File:** `frontend/package.json`

```json
{
  "dependencies": {
    "@react-oauth/google": "^0.13.4",
    "axios": "^1.13.2",
    // ... other dependencies
  }
}
```

**Install command:**
```bash
npm install @react-oauth/google
```

### 4.2 Providers Setup

**File:** `frontend/app/providers.tsx`

```typescript
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/lib/hooks/useAuth';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  // If no Google Client ID is provided, skip Google OAuth provider
  if (!googleClientId) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </AuthProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}
```

**Purpose:**
- Initializes the Google OAuth SDK with your Client ID
- Wraps the entire app to make Google OAuth available everywhere
- Gracefully handles missing Client ID (app works without Google OAuth)

### 4.3 Auth API Client

**File:** `frontend/lib/api/auth.ts`

```typescript
import apiClient from './client';
import { ApiResponse, User } from '@/types';

export const authApi = {
  // Register new user
  register: async (data: { email: string; password: string; fullName: string }) => {
    const response = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
      '/auth/register',
      data
    );
    return response.data;
  },

  // Login user
  login: async (data: { email: string; password: string }) => {
    const response = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
      '/auth/login',
      data
    );
    return response.data;
  },

  // Logout user
  logout: async () => {
    const response = await apiClient.post<ApiResponse<null>>('/auth/logout');
    return response.data;
  },

  // Get current user
  me: async () => {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return response.data;
  },

  // Google OAuth
  googleAuth: async (data: {
    googleId: string;
    email: string;
    fullName: string;
    avatar?: string;
  }) => {
    const response = await apiClient.post<ApiResponse<{ user: User; accessToken: string }>>(
      '/auth/google',
      data
    );
    return response.data;
  },
};
```

### 4.4 Auth Hook

**File:** `frontend/lib/hooks/useAuth.tsx`

```typescript
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (userOrEmail: User | string, passwordOrToken?: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  googleLogin: (googleData: { googleId: string; email: string; fullName: string; avatar?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await authApi.me();
      if (response.success && response.data) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      localStorage.removeItem('accessToken');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userOrEmail: User | string, passwordOrToken?: string) => {
    if (typeof userOrEmail === 'object') {
      setUser(userOrEmail);
      return;
    }

    const response = await authApi.login({ email: userOrEmail, password: passwordOrToken! });
    if (response.success && response.data) {
      localStorage.setItem('accessToken', response.data.accessToken);
      setUser(response.data.user);
      router.push('/home');
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    const response = await authApi.register({ email, password, fullName });
    if (response.success && response.data) {
      if (response.data.requiresVerification) {
        return;
      }
      if (response.data.accessToken) {
        localStorage.setItem('accessToken', response.data.accessToken);
        setUser(response.data.user);
        router.push('/home');
      }
    }
  };

  const googleLogin = async (googleData: {
    googleId: string;
    email: string;
    fullName: string;
    avatar?: string
  }) => {
    try {
      const response = await authApi.googleAuth(googleData);
      if (response.success && response.data) {
        localStorage.setItem('accessToken', response.data.accessToken);
        setUser(response.data.user);
        router.push('/home');
      }
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        googleLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Key Functions:**
- `googleLogin`: Handles Google OAuth login
- Stores JWT token in localStorage
- Updates auth state
- Redirects to home page

### 4.5 Login Page Implementation

**File:** `frontend/app/(auth)/login/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

export default function LoginPage() {
  const { login, googleLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Regular email/password login
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth login
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      try {
        // Step 1: Get user info from Google using the access token
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          }
        );

        // Step 2: Extract user data from Google's response
        const { sub: googleId, email, name, picture } = userInfoResponse.data;

        // Step 3: Send to our backend
        await googleLogin({
          googleId,        // Google's unique user ID
          email,           // User's email
          fullName: name,  // User's full name
          avatar: picture, // Profile picture URL
        });

        toast.success("Welcome back!");
      } catch (error: any) {
        toast.error("Google login failed. Please try again.");
        console.error("Google login error:", error);
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error("Google login failed. Please try again.");
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">MoneyMata</h1>
          <p className="text-gray-600 mt-2">
            Welcome back! Log in to your account
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-600"
                placeholder="you@example.com"
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-600"
                placeholder="••••••••"
              />
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span className="text-gray-700 font-medium">
              {isGoogleLoading ? "Signing in..." : "Sign in with Google"}
            </span>
          </button>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Don't have an account?{" "}
              <Link
                href="/register"
                className="text-blue-600 font-semibold hover:text-blue-700">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4.6 Register Page Implementation

**File:** `frontend/app/(auth)/register/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';

export default function RegisterPage() {
  const { register, googleLogin } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Regular email/password registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, fullName);
      toast.success(
        "Registration successful! Please check your email to verify your account.",
        {
          duration: 5000,
        }
      );
      // Clear form
      setFullName("");
      setEmail("");
      setPassword("");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message ||
          "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth signup
  const handleGoogleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsGoogleLoading(true);
      try {
        // Get user info from Google
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          }
        );

        const { sub: googleId, email, name, picture } = userInfoResponse.data;

        await googleLogin({
          googleId,
          email,
          fullName: name,
          avatar: picture,
        });

        toast.success("Account created successfully!");
      } catch (error: any) {
        toast.error("Google sign up failed. Please try again.");
        console.error("Google signup error:", error);
      } finally {
        setIsGoogleLoading(false);
      }
    },
    onError: () => {
      toast.error("Google sign up failed. Please try again.");
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl mb-4">
            <Wallet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">MoneyMata</h1>
          <p className="text-gray-600 mt-2">
            Create your account to get started
          </p>
        </div>

        {/* Register Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name Input */}
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-600"
                placeholder="John Doe"
              />
            </div>

            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-600"
                placeholder="you@example.com"
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-gray-600"
                placeholder="••••••••"
              />
              <p className="text-xs text-gray-500 mt-1">
                Must be at least 6 characters
              </p>
            </div>

            {/* Register Button */}
            <button
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* Google Sign Up Button */}
          <button
            type="button"
            onClick={() => handleGoogleSignup()}
            disabled={isLoading || isGoogleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span className="text-gray-700 font-medium">
              {isGoogleLoading ? "Signing up..." : "Sign up with Google"}
            </span>
          </button>

          {/* Login Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-blue-600 font-semibold hover:text-blue-700">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 5. Complete Flow Explanation

### 🔄 Authentication Flow Diagram

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐         ┌──────────────┐
│   Browser   │         │   Frontend   │         │   Google    │         │   Backend    │
│   (User)    │         │   Next.js    │         │   OAuth     │         │   Express    │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘         └──────┬───────┘
       │                       │                        │                        │
       │ 1. Click "Sign in     │                        │                        │
       │    with Google"       │                        │                        │
       ├──────────────────────>│                        │                        │
       │                       │                        │                        │
       │                       │ 2. Initialize OAuth    │                        │
       │                       ├───────────────────────>│                        │
       │                       │                        │                        │
       │ 3. Open Google        │                        │                        │
       │    Login Popup        │                        │                        │
       │<──────────────────────┤                        │                        │
       │                       │                        │                        │
       │ 4. User logs in       │                        │                        │
       │    with Google        │                        │                        │
       ├───────────────────────┼───────────────────────>│                        │
       │                       │                        │                        │
       │                       │    5. Return Token     │                        │
       │<──────────────────────┼────────────────────────┤                        │
       │                       │                        │                        │
       │                       │ 6. Fetch user info     │                        │
       │                       │    (GET /userinfo)     │                        │
       │                       ├───────────────────────>│                        │
       │                       │                        │                        │
       │                       │ 7. User Data           │                        │
       │                       │ {sub, email, name}     │                        │
       │                       │<───────────────────────┤                        │
       │                       │                        │                        │
       │                       │ 8. POST /api/auth/google                        │
       │                       │ {googleId, email, fullName, avatar}             │
       │                       ├─────────────────────────────────────────────────>│
       │                       │                        │                        │
       │                       │                        │        9. Find or      │
       │                       │                        │           Create User  │
       │                       │                        │                        │
       │                       │                        │       10. Generate JWT │
       │                       │                        │                        │
       │                       │ 11. Return JWT + User Data                      │
       │                       │<─────────────────────────────────────────────────┤
       │                       │                        │                        │
       │ 12. Store Token       │                        │                        │
       │     in localStorage   │                        │                        │
       │                       │                        │                        │
       │ 13. Redirect to       │                        │                        │
       │     /home             │                        │                        │
       │<──────────────────────┤                        │                        │
```

### 📝 Step-by-Step Detailed Explanation

#### **Step 1-3: User Initiates Google Login**
- User clicks "Sign in with Google" button
- `useGoogleLogin` hook triggers
- Google OAuth popup window opens

#### **Step 4-5: Google Authentication**
```javascript
// User completes login on Google's servers
// Google returns an access_token
{
  access_token: "ya29.a0AfH6SMBx...",
  expires_in: 3599,
  scope: "email profile openid",
  token_type: "Bearer"
}
```

#### **Step 6-7: Fetch User Info from Google**
```javascript
// Frontend makes request to Google's API
GET https://www.googleapis.com/oauth2/v3/userinfo
Authorization: Bearer ya29.a0AfH6SMBx...

// Google returns user information
{
  "sub": "1234567890",                    // Google's unique user ID
  "email": "user@gmail.com",
  "email_verified": true,
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe",
  "picture": "https://lh3.googleusercontent.com/a/xxx",
  "locale": "en"
}
```

#### **Step 8: Send to Backend**
```javascript
// Frontend sends extracted data to our backend
POST http://localhost:5000/api/auth/google
Content-Type: application/json

{
  "googleId": "1234567890",
  "email": "user@gmail.com",
  "fullName": "John Doe",
  "avatar": "https://lh3.googleusercontent.com/a/xxx"
}
```

#### **Step 9-10: Backend Processing**

**Scenario 1: New User**
```javascript
// Create new user
const user = await User.create({
  email: "user@gmail.com",
  fullName: "John Doe",
  googleId: "1234567890",
  avatar: "https://...",
  isEmailVerified: true,  // Auto-verified
  password: Math.random().toString(36)  // Random (not used)
});

// Create subscription
await UserSubscription.create({
  userId: user._id,
  tier: 'free'
});

// Send welcome email
await emailService.sendWelcomeEmail(user.email, user.fullName);
```

**Scenario 2: Existing Email User (No Google ID)**
```javascript
// User with email exists but no Google ID
const user = await User.findOne({ email: "user@gmail.com" });

// Link Google account
user.googleId = "1234567890";
user.isEmailVerified = true;
user.avatar = "https://...";
await user.save();
```

**Scenario 3: Existing Google User**
```javascript
// User already has Google ID
const user = await User.findOne({ googleId: "1234567890" });
// Just proceed to login
```

**Generate JWT Tokens:**
```javascript
const { accessToken, refreshToken } = await generateTokenPair({
  userId: user._id.toString(),
  email: user.email,
  tier: 'free'
});

// Store refresh token
await RefreshToken.create({
  userId: user._id,
  token: hashedRefreshToken,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
});

// Set HTTP-only cookie
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000
});
```

#### **Step 11: Backend Response**
```javascript
{
  "success": true,
  "message": "Google authentication successful",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@gmail.com",
      "fullName": "John Doe",
      "avatar": "https://lh3.googleusercontent.com/a/xxx",
      "tier": "free"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### **Step 12-13: Frontend Completion**
```javascript
// Save access token
localStorage.setItem('accessToken', response.data.accessToken);

// Update auth state
setUser(response.data.user);

// Redirect to home
router.push('/home');

// Show success message
toast.success("Welcome back!");
```

---

## 6. Testing

### Manual Testing Steps

#### **Test 1: New User Registration via Google**

1. **Clear Data** (ensure fresh state):
   ```bash
   # Clear browser localStorage
   localStorage.clear();

   # Delete user from MongoDB (if exists)
   db.users.deleteOne({ email: "your-test-email@gmail.com" });
   ```

2. **Navigate to Login/Register Page**:
   - Open `http://localhost:3000/login`
   - Or `http://localhost:3000/register`

3. **Click "Sign in/up with Google"**

4. **Complete Google Login**:
   - Select your Google account
   - Grant permissions if prompted

5. **Verify Success**:
   - ✅ Should redirect to `/home`
   - ✅ Should see success toast message
   - ✅ Should see user avatar in navbar

6. **Check Database**:
   ```javascript
   // MongoDB query
   db.users.findOne({ email: "your-test-email@gmail.com" })

   // Should return:
   {
     _id: ObjectId("..."),
     email: "your-test-email@gmail.com",
     fullName: "Your Name",
     googleId: "1234567890",
     avatar: "https://lh3.googleusercontent.com/...",
     isEmailVerified: true,
     createdAt: ISODate("..."),
     updatedAt: ISODate("...")
   }
   ```

7. **Check Subscription**:
   ```javascript
   db.usersubscriptions.findOne({ userId: ObjectId("...") })

   // Should return:
   {
     _id: ObjectId("..."),
     userId: ObjectId("..."),
     tier: "free",
     receiptsScannedThisMonth: 0,
     monthResetDate: ISODate("...")
   }
   ```

8. **Check Email**:
   - ✅ Should receive welcome email

#### **Test 2: Existing Google User Login**

1. **Navigate to Login Page**:
   - `http://localhost:3000/login`

2. **Click "Sign in with Google"**

3. **Select Same Google Account**

4. **Verify**:
   - ✅ Should log in instantly
   - ✅ Should redirect to `/home`
   - ✅ No duplicate user created in database

#### **Test 3: Link Google to Existing Email Account**

1. **Create Regular Account First**:
   - Register with email/password
   - Email: `test@gmail.com`
   - Password: `password123`

2. **Logout**

3. **Login with Google** (using same email):
   - Click "Sign in with Google"
   - Use Google account with email `test@gmail.com`

4. **Verify**:
   - ✅ Should link Google to existing account
   - ✅ Database should have both `password` and `googleId` fields
   - ✅ Can now login with either email/password OR Google

#### **Test 4: Error Handling**

1. **Test Missing Client ID**:
   ```bash
   # Remove Google Client ID from .env.local
   # Restart frontend
   ```
   - ✅ App should still work
   - ✅ Google button should not appear or be disabled

2. **Test Network Error**:
   - Disconnect internet after Google login
   - ✅ Should show error toast
   - ✅ Should not crash

3. **Test Backend Down**:
   - Stop backend server
   - Try Google login
   - ✅ Should show error message

### Debugging Tips

#### **Check Browser Console**

```javascript
// Check if Google OAuth is initialized
console.log(window.google);

// Check localStorage for token
console.log(localStorage.getItem('accessToken'));

// Decode JWT to see payload
const token = localStorage.getItem('accessToken');
const base64Url = token.split('.')[1];
const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
const payload = JSON.parse(window.atob(base64));
console.log(payload);
```

#### **Check Backend Logs**

```bash
# Backend should log:
🚀 Server running in development mode on port 5000
✅ MongoDB Connected
📧 Email service initialized

# On Google login:
POST /api/auth/google 200 (successful)
```

#### **Common Issues**

| Issue | Solution |
|-------|----------|
| "Missing required parameter client_id" | Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to `.env.local` |
| "Redirect URI mismatch" | Add `http://localhost:3000` to authorized redirect URIs in Google Console |
| "Invalid token" | Check that JWT_SECRET is set in backend `.env` |
| "User already exists" | Expected for existing users - should link accounts |
| Google popup blocked | Allow popups in browser settings |

---

## 🎯 Key Security Features

### 1. **Client-Side OAuth Flow**
- User authentication happens on Google's servers
- Access token never passes through our backend
- We only receive verified user data

### 2. **JWT Token Security**
- **Access Token**: 15 minutes (short-lived)
  - Stored in `localStorage`
  - Used for API requests
  - Short expiry minimizes risk if compromised

- **Refresh Token**: 7 days (long-lived)
  - Stored as HTTP-only cookie
  - Cannot be accessed by JavaScript
  - Used to get new access tokens

### 3. **Auto Email Verification**
- Google users are automatically verified
- `isEmailVerified: true` set immediately
- No need for verification email

### 4. **Account Linking**
- If email already exists, links Google account
- Prevents duplicate accounts
- User can login with either method

### 5. **Password Handling**
- OAuth users get random password
- Password field is optional
- Bcrypt hashing for email/password users

### 6. **CORS Protection**
```typescript
// Backend CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

### 7. **Cookie Security**
```typescript
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,                           // Cannot be accessed by JavaScript
  secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
  sameSite: 'strict',                      // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000         // 7 days
});
```

---

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [@react-oauth/google NPM Package](https://www.npmjs.com/package/@react-oauth/google)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)

---

## 🔄 Production Deployment Checklist

When deploying to production:

### Frontend:
- [ ] Update `NEXT_PUBLIC_GOOGLE_CLIENT_ID` with production Client ID
- [ ] Add production domain to Google Console authorized origins
- [ ] Add production URLs to authorized redirect URIs

### Backend:
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS for production
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Enable `secure: true` for cookies

### Google Console:
- [ ] Verify OAuth consent screen is published
- [ ] Add production domains to authorized origins:
  ```
  https://yourdomain.com
  https://www.yourdomain.com
  ```
- [ ] Add production redirect URIs:
  ```
  https://yourdomain.com
  https://yourdomain.com/login
  https://yourdomain.com/register
  ```

---

**Document Created:** January 2026
**Last Updated:** January 2026
**Version:** 1.0
**Project:** MoneyMata Expense Tracker
