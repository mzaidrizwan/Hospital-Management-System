import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

const USERS_COLLECTION = 'users';

// Register new user (Admin के लिए)
export const registerUser = async (
  email: string, 
  password: string, 
  userData: { name: string; role: UserRole; phone?: string }
): Promise<boolean> => {
  try {
    // Firebase Authentication में user create करें
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Firestore में user document create करें
    const userDoc = {
      id: firebaseUser.uid,
      email: email,
      name: userData.name,
      role: userData.role,
      phone: userData.phone || '',
      createdAt: new Date().toISOString(),
      isActive: true
    };

    await setDoc(doc(db, USERS_COLLECTION, firebaseUser.uid), userDoc);
    return true;
  } catch (error: any) {
    console.error('Registration error:', error);
    throw new Error(error.message || 'Failed to register user');
  }
};

// Login user
export const loginUser = async (email: string, password: string): Promise<User | null> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Firestore से user data fetch करें
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, firebaseUser.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        phone: userData.phone,
        createdAt: userData.createdAt
      } as User;
    }
    return null;
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Failed to login');
  }
};

// Change password (current user के लिए)
export const changeUserPassword = async (
  currentPassword: string,
  newPassword: string
): Promise<boolean> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('No authenticated user');
    }

    // Re-authenticate user
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      currentPassword
    );
    
    await reauthenticateWithCredential(currentUser, credential);
    
    // Update password
    await updatePassword(currentUser, newPassword);
    return true;
  } catch (error: any) {
    console.error('Password change error:', error);
    throw new Error(error.message || 'Failed to change password');
  }
};

// Admin: किसी भी user का password reset करें
export const adminResetPassword = async (
  userId: string,
  newPassword: string
): Promise<boolean> => {
  try {
    // Note: Firebase Admin SDK server side pe required होगा
    // ये एक placeholder function है
    console.log(`Admin reset password for user: ${userId}`);
    
    // In production, you'll need a Firebase Cloud Function for this
    // या Firebase Admin SDK use करें backend pe
    
    return true;
  } catch (error) {
    console.error('Admin reset password error:', error);
    throw new Error('Failed to reset password');
  }
};

// Logout user
export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Get current user from Firestore
export const getCurrentUserData = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        phone: userData.phone,
        createdAt: userData.createdAt
      } as User;
    }
    return null;
  } catch (error) {
    console.error('Get user data error:', error);
    return null;
  }
};

// Update user profile
export const updateUserProfile = async (
  userId: string,
  updates: { name?: string; phone?: string }
): Promise<boolean> => {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (error) {
    console.error('Update profile error:', error);
    throw error;
  }
};