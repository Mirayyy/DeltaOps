const ROLE_LEVELS = { admin: 3, member: 2, guest: 1 }

export function canAccess(userRole, requiredRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[requiredRole] || 0)
}

export function isAdmin(userRole) {
  return userRole === 'admin'
}

export function isMember(userRole) {
  return userRole === 'member' || userRole === 'admin'
}

export function isGuest(userRole) {
  return userRole === 'guest' || !userRole
}

export function canEditReadiness(userRole, userUid, targetUid) {
  return isAdmin(userRole) || (isMember(userRole) && userUid === targetUid)
}

export function canEditLineup(userRole) {
  return isAdmin(userRole)
}

export function canManagePlayers(userRole) {
  return isAdmin(userRole)
}
