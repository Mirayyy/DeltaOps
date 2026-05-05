export async function writeAuditLog(entry) {
  try {
    const { useAuditLogsStore } = await import('../stores/auditLogs')
    const auditLogs = useAuditLogsStore()
    await auditLogs.logEvent(entry)
  } catch (error) {
    console.warn('writeAuditLog failed:', error.message)
  }
}
