import { SetMetadata } from '@nestjs/common';

export interface PermissionDef {
  module: string;
  action: 'read' | 'write' | 'delete' | 'export' | 'admin';
}

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (module: string, action: PermissionDef['action']) =>
  SetMetadata(PERMISSION_KEY, { module, action });
