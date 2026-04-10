import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { CallQualification } from '@prisma/client';

export class QualifyCallDto {
  @IsString() callId!: string;
  @IsString() callLogId!: string;

  @IsEnum(CallQualification)
  qualification!: CallQualification;

  @IsOptional() @IsString()  agentNotes?: string;
  @IsOptional() @IsDateString() rdvAt?: string;       // si APPOINTMENT
  @IsOptional() @IsDateString() callbackAt?: string;  // si CALLBACK
  @IsOptional() @IsString()  scriptResponseId?: string;
  @IsOptional() @IsString()  campaignId?: string;
  @IsOptional() @IsBoolean() nextCall?: boolean;      // passer au prochain appel

  // Fiche client à créer/compléter si qualification = APPOINTMENT
  @IsOptional() @IsString() clientFirstName?: string;
  @IsOptional() @IsString() clientLastName?: string;
  @IsOptional() @IsString() clientPhone?: string;
  @IsOptional() @IsString() clientEmail?: string;
  @IsOptional() @IsString() clientCompany?: string;
  @IsOptional() @IsString() clientAddress?: string;
  @IsOptional() @IsString() clientPostalCode?: string;
  @IsOptional() @IsString() clientNotes?: string;
}

export const QUALIF_META: Record<CallQualification, {
  label: string; color: string; icon: string; needsDate?: boolean; dateField?: string;
}> = {
  SALE:          { label: 'Vente',           color: '#16a34a', icon: '💰' },
  APPOINTMENT:   { label: 'RDV',             color: '#2563eb', icon: '📅', needsDate: true,  dateField: 'rdvAt' },
  NOT_INTERESTED:{ label: 'Pas intéressé',   color: '#6b7280', icon: '🚫' },
  CALLBACK:      { label: 'Rappel',          color: '#f59e0b', icon: '🔁', needsDate: true,  dateField: 'callbackAt' },
  WRONG_NUMBER:  { label: 'Faux numéro',     color: '#9ca3af', icon: '📵' },
  VOICEMAIL:     { label: 'Répondeur',       color: '#8b5cf6', icon: '📬' },
  DNC:           { label: 'DNC',             color: '#dc2626', icon: '⛔' },
  NRP:           { label: 'NRP',             color: '#ef4444', icon: '📞' },
  UNREACHABLE:   { label: 'Injoignable',     color: '#f97316', icon: '📵' },
  REFUSAL:       { label: 'Refus',           color: '#b91c1c', icon: '✋' },
  OUT_OF_TARGET: { label: 'Hors cible (HC)', color: '#d97706', icon: '🎯' },
  OTHER:         { label: 'Autre',           color: '#64748b', icon: '📝' },
};
