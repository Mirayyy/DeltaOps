export function cloneForAudit(value) {
  if (value === undefined) return null
  if (value === null) return null
  return JSON.parse(JSON.stringify(value))
}

export async function writeAuditLog(entry) {
  try {
    const { useAuditLogsStore } = await import('../stores/auditLogs')
    const auditLogs = useAuditLogsStore()
    await auditLogs.logEvent(entry)
  } catch (error) {
    console.warn('writeAuditLog failed:', error.message)
  }
}

export async function logEntitySnapshot({
  entityType,
  entityId,
  before = null,
  after = null,
  action = null,
  summary = '',
  metadata = null,
}) {
  const normalizedBefore = cloneForAudit(before)
  const normalizedAfter = cloneForAudit(after)

  const inferredAction = action || (
    normalizedBefore && normalizedAfter ? 'update'
      : normalizedAfter ? 'create'
        : 'delete'
  )

  await writeAuditLog({
    action: inferredAction,
    entityType,
    entityId,
    summary: summary || `${entityType} - ${inferredAction} - ${entityId}`,
    before: normalizedBefore,
    after: normalizedAfter,
    metadata: cloneForAudit(metadata),
  })
}
