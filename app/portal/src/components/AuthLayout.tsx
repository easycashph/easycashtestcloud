import * as React from 'react';
import { Link } from 'react-router-dom';
import { Card } from './ui/Card';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-secondary/40 px-4 py-12">
      <Link to="/" className="mb-8 flex items-center gap-2.5">
        <img src="./logo-easycash.png" alt="Easycash" className="h-10 w-10 rounded-xl object-contain" />
        <span className="text-lg font-bold tracking-tight">Easycash Portal</span>
      </Link>
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}
