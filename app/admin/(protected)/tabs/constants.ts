export const FORMS = [1, 2, 3, 4, 5, 6];

export type UserProfile = {
  id: string;
  full_name: string;
  grade: number;
  school: string | null;
  role: string;
  teacher_approved?: boolean;
  created_at: string;
};
