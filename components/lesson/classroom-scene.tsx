'use client';

import { ReactNode } from 'react';
import { TeacherAvatar, TeacherAvatarState } from '@/components/teacher/TeacherAvatar';

interface ClassroomSceneProps {
  teacherName: string;
  grade?: number;
  avatarState: TeacherAvatarState;
  writing: boolean;
  boardItems: { type: string; content: string }[];
  lessonTitle: string;
  status: string;
  children?: ReactNode;
}

export function ClassroomScene({
  teacherName,
  grade,
  avatarState,
  writing,
  boardItems,
  lessonTitle,
  status,
  children,
}: ClassroomSceneProps) {
  return (
    <section className="classroom-scene" aria-label={`${teacherName} teaching ${lessonTitle}`}>
      <div className="classroom-window classroom-window-one" />
      <div className="classroom-window classroom-window-two" />
      <div className="classroom-clock">SMARTCLASS / {grade ? `FORM ${grade}` : 'LESSON'}</div>

      <div className="classroom-board" aria-label="Smart board">
        <div className="classroom-board-bar">
          <span>{lessonTitle}</span>
          <span className="classroom-board-status">{writing ? 'Writing' : 'Smart board'}</span>
        </div>
        <div className="classroom-board-content">
          {boardItems.length === 0 ? (
            <p className="classroom-board-empty">The lesson board is ready.</p>
          ) : (
            boardItems.slice(-4).map((item, index) => (
              <div key={`${item.content}-${index}`} className={item.type === 'heading' ? 'classroom-board-heading' : 'classroom-board-line'}>
                {item.content}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="classroom-teacher">
        <TeacherAvatar state={avatarState} writing={writing} size="lg" name={teacherName} />
        <div className="classroom-teacher-shadow" />
        <div className="classroom-teacher-label">
          <strong>{teacherName}</strong>
          <span>{status}</span>
        </div>
      </div>

      <div className="classroom-desks" aria-hidden="true">
        <div className="classroom-student classroom-student-one" />
        <div className="classroom-student classroom-student-two" />
        <div className="classroom-student classroom-student-three" />
        <div className="classroom-student classroom-student-four" />
        <div className="classroom-desk classroom-desk-one" />
        <div className="classroom-desk classroom-desk-two" />
        <div className="classroom-desk classroom-desk-three" />
      </div>

      <div className="classroom-overlay">
        <span className="classroom-live-dot" /> Classroom
        {children}
      </div>
    </section>
  );
}