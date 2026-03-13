export type UserRole = 'admin' | 'faculty' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  college?: string;
  isBlocked: boolean;
  needsRoleSelection?: boolean;
  createdAt: any;
}

export interface VisitorLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  college: string;
  reason: string;
  timestamp: any;
}

export const COLLEGES = [
  "College of Arts and Sciences",
  "College of Business Administration",
  "College of Education",
  "College of Engineering and Architecture",
  "College of Informatics and Computing Studies",
  "College of Nursing",
  "College of Music",
  "College of Law",
  "Graduate School",
  "Administrative Office",
  "Others"
];

export const REASONS = [
  "Reading",
  "Research",
  "Use of Computer",
  "Studying",
  "Others"
];
