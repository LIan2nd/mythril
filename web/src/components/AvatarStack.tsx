import type { User } from "../domain/types";
import { MY_CODE } from "../lib/board-reducer";

interface AvatarStackProps {
  user: User;
}

export function AvatarStack({ user }: AvatarStackProps) {
  return (
    <span className="who">
      <span className="avatar" style={{ background: `var(--${user.avatarColor})` }}>
        {user.code}
      </span>
      {user.code === MY_CODE ? "YOU" : user.code}
    </span>
  );
}
