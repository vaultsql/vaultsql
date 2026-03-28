import type { User } from '@/queries/groups'
import { Avatar } from './catalyst/avatar'

function getInitials(user: User): string {
  if (user.name) {
    const parts = user.name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    }
    return user.name.substring(0, 2).toUpperCase()
  }
  return user.email.substring(0, 2).toUpperCase()
}

interface UserAvatarProps {
  user: User
  className?: string
}

export function UserAvatar({ user, className = 'size-8' }: UserAvatarProps) {
  const initials = getInitials(user)
  const name = user.name || user.email
  const imageUrl = 'image_url' in user ? user.image_url : undefined

  return <Avatar src={imageUrl} initials={initials} alt={name} className={className} />
}
