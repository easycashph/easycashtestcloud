import { LogOut, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRole } from '@/lib/roleContext';
import { avatarColorClasses } from '@/lib/avatarColor';

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Frontend↔Backend Wiring Pilot, Stage 0b. Replaces the old mock "Switch Account" panel - with a
 * real login/session, there's no "switching" between staff accounts without their password
 * anymore, so this is a normal current-user menu instead: name/role, a link into Settings, and a
 * real Logout (`POST /auth/logout`).
 */
export function AccountMenu() {
  const { currentAccount, logout } = useRole();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex h-auto items-center gap-2 px-2 py-1">
          <Avatar>
            <AvatarFallback className={avatarColorClasses(currentAccount.name)}>{initialsOf(currentAccount.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left text-xs leading-tight sm:block">
            <p className="font-medium">{currentAccount.name}</p>
            <p className="text-muted-foreground">{currentAccount.role}</p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="font-medium">{currentAccount.name}</p>
          <p className="text-xs font-normal text-muted-foreground">{currentAccount.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/configuration/settings')}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void logout()}>
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
