"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import {
  beginTotpAction,
  changePasswordAction,
  confirmTotpAction,
  disableTotpAction,
  regenerateCodesAction,
} from "@/app/admin/(protected)/_actions/features";
import { CodesBox, StatusLine, SubmitButton, TextField, useToastAction } from "./forms";
import { buttonStyles } from "./ui";
import { useAdminUi } from "./provider";

export function ChangePasswordForm() {
  const [state, action, pending] = useToastAction(changePasswordAction, { refresh: false });
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <TextField label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
      <TextField label="New password" name="newPassword" type="password" autoComplete="new-password" required help="At least 12 characters. A passphrase of several words works well." />
      <TextField label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending}>Change password</SubmitButton>
        <StatusLine state={state} />
      </div>
      <p className="text-xs text-fg-subtle">Changing your password signs out your other sessions.</p>
    </form>
  );
}

type Props = { enabled: boolean; recoveryLeft: number; pending: { secret: string; uri: string } | null };

export function TwoFactorPanel({ enabled, recoveryLeft, pending: pendingSetup }: Props) {
  const router = useRouter();
  const { toast } = useAdminUi();
  const [starting, startTransition] = useTransition();
  const [confirmState, confirmAction, confirming] = useToastAction(confirmTotpAction);
  const [regenState, regenAction, regenerating] = useToastAction(regenerateCodesAction);
  const [disableState, disableAction, disabling] = useToastAction(disableTotpAction);
  const [cancelled, setCancelled] = useState(false);

  const start = () =>
    startTransition(async () => {
      const res = await beginTotpAction();
      if (res.status === "error") toast("error", res.message);
      else router.refresh();
    });

  // Codes are kept in this component's state so they survive the refresh that follows enabling 2FA.
  const codes = confirmState.status === "ok" && confirmState.codes ? confirmState.codes : regenState.status === "ok" && regenState.codes ? regenState.codes : null;

  return (
    <div className="space-y-5">
      <p className="flex items-center gap-2 text-sm">
        {enabled ? <ShieldCheck aria-hidden className="h-5 w-5 text-tech" /> : <ShieldOff aria-hidden className="h-5 w-5 text-business" />}
        <span className="font-medium">{enabled ? "Two-factor authentication is on" : "Two-factor authentication is off"}</span>
      </p>

      {codes && <CodesBox codes={codes} />}

      {!enabled && !pendingSetup && (
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">
            Adds a second step at sign-in using an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…). You will get one-time recovery codes in case you lose your phone.
          </p>
          <button type="button" onClick={start} disabled={starting} className={buttonStyles.primary}>
            <KeyRound aria-hidden className="h-4 w-4" /> Set up two-factor authentication
          </button>
        </div>
      )}

      {!enabled && pendingSetup && !cancelled && (
        <div className="space-y-4 rounded-2xl border border-line-strong p-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-fg-muted">
            <li>
              In your authenticator app choose <em>Add account</em>, then <em>Enter a setup key</em>.
            </li>
            <li>
              Enter this key (account: your email, type: time-based):
              <p className="mt-2 select-all break-all rounded-lg bg-ink-900 px-3 py-2 font-mono text-sm tracking-wider text-fg">{pendingSetup.secret}</p>
            </li>
            <li>
              On a phone you can also open <a className="underline hover:text-fg" href={pendingSetup.uri}>this setup link</a>.
            </li>
            <li>Enter the 6-digit code the app shows to finish.</li>
          </ol>
          <form action={confirmAction} className="flex flex-wrap items-end gap-3" aria-busy={confirming}>
            <div className="w-40">
              <TextField label="6-digit code" name="code" autoComplete="one-time-code" required maxLength={7} placeholder="123456" />
            </div>
            <SubmitButton pending={confirming}>Turn on</SubmitButton>
            <button type="button" className={buttonStyles.ghost} onClick={() => setCancelled(true)}>
              Hide
            </button>
          </form>
          <StatusLine state={confirmState} />
        </div>
      )}

      {enabled && (
        <div className="space-y-6">
          <p className="text-sm text-fg-muted">
            Unused recovery codes: <span className="font-medium text-fg">{recoveryLeft}</span>
            {recoveryLeft <= 2 && <span className="text-business"> (running low: generate new ones)</span>}
          </p>
          <form action={regenAction} className="space-y-3 rounded-2xl border border-line-strong p-4" aria-busy={regenerating}>
            <h3 className="text-sm font-medium">Generate new recovery codes</h3>
            <p className="text-xs text-fg-subtle">Needs your password and a current code. The old codes stop working.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
              <TextField label="Authentication code" name="code" autoComplete="one-time-code" required placeholder="123456" />
            </div>
            <SubmitButton pending={regenerating} variant="secondary">Generate new codes</SubmitButton>
            <StatusLine state={regenState} />
          </form>
          <form action={disableAction} className="space-y-3 rounded-2xl border border-red-500/30 p-4" aria-busy={disabling}>
            <h3 className="text-sm font-medium">Turn off two-factor authentication</h3>
            <p className="text-xs text-fg-subtle">Needs your password and a current code (or a recovery code).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
              <TextField label="Authentication or recovery code" name="code" autoComplete="one-time-code" required />
            </div>
            <SubmitButton pending={disabling} variant="danger">Turn off</SubmitButton>
            <StatusLine state={disableState} />
          </form>
        </div>
      )}
    </div>
  );
}
