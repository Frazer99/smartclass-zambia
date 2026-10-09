'use client';

import { Fragment } from 'react';
import { BlockMath, InlineMath } from 'react-katex';

type MathTextProps = {
  children: string;
  className?: string;
};

export function MathText({ children, className }: MathTextProps) {
  const parts = children.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('$$') && part.endsWith('$$')) {
          return <BlockMath key={index} math={part.slice(2, -2)} errorColor="#fca5a5" />;
        }
        if (part.startsWith('$') && part.endsWith('$')) {
          return <InlineMath key={index} math={part.slice(1, -1)} errorColor="#fca5a5" />;
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </span>
  );
}
