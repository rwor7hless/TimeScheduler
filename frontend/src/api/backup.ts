import api from './client'

export interface S3BackupResult {
  status: 'ok'
  key: string
  size: number
  durationMs: number
}

export const backupApi = {
  triggerS3: () =>
    api.post<S3BackupResult>('/backup/s3-trigger').then((r) => r.data),
}
