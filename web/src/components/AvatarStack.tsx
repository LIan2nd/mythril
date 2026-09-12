import type { User } from "../domain/types";
import { useBoard } from "../lib/store";

interface AvatarStackProps {
  user: User;
}

export function AvatarStack({ user }: AvatarStackProps) {
  const { user: session } = useBoard();
  return (
    <span className="who">
      <span className="avatar" style={{ background: `var(--${user.avatarColor})` }}>
        {user.code}
      </span>
      {session?.code && user.code === session.code ? "YOU" : user.code}
    </span>
  );
}
