import * as React from 'react';
import Image from 'next/image';

export function Logo(props: React.ComponentProps<'div'>) {
  return (
    <div className="flex items-center gap-2" {...props}>
      <Image src="/multamind-logo.svg" alt="MultaMind Logo" width={24} height={24} />
      <h1 className="text-lg font-semibold text-foreground">MultaMind</h1>
    </div>
  );
}
