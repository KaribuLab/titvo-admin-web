import React, { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { Label } from './ui/label'

export interface RawKeyModalProps {
  label: string
  apiKey: string
  onDismiss: () => void
}

/**
 * One-time raw API key reveal (spec: Create Key With Show-Once Raw Value /
 * Raw Key Permanently Unavailable; design.md "the one genuinely new
 * primitive"). Built on shadcn's `Dialog` (Radix), but deliberately
 * stripped of every dismiss path Radix gives a dialog by default: no
 * backdrop click, no Escape key, no close icon (`DialogContent`'s
 * `hideClose`) — `onInteractOutside`/`onEscapeKeyDown` both call
 * `preventDefault()` so Radix never fires `onOpenChange` for those. The
 * only way out is the "Done" button, which stays disabled until the
 * explicit "I've copied this key" checkbox is checked. `apiKey` only ever
 * exists here as a render prop — this component never copies it into any
 * state of its own beyond what's needed to render it; the caller is
 * responsible for dropping its own reference in `onDismiss` so nothing
 * outlives this modal.
 */
export function RawKeyModal ({ label, apiKey, onDismiss }: RawKeyModalProps): React.ReactElement {
  const { t } = useTranslation()
  const [acknowledged, setAcknowledged] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy (): Promise<void> {
    try {
      await navigator.clipboard.writeText(apiKey)
      setCopied(true)
    } catch {
      // Clipboard access can be denied or unavailable — the raw value is
      // still visible and selectable in the reveal panel below, so this
      // is not fatal to the one-time reveal itself.
    }
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        hideClose
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => event.preventDefault()}
        onPointerDownOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('apiKeys.keyCreatedTitle')}</DialogTitle>
          <DialogDescription>
            <Trans i18nKey="apiKeys.keyCreatedDescription" values={{ label }} components={{ bold: <strong /> }} />
          </DialogDescription>
        </DialogHeader>

        <div className="break-all rounded-md border bg-muted px-3 py-2 font-mono text-sm">{apiKey}</div>

        <Button type="button" variant="secondary" onClick={() => { void handleCopy() }} className="w-fit">
          {copied ? <><Check /> {t('apiKeys.copied')}</> : <><Copy /> {t('apiKeys.copyKey')}</>}
        </Button>

        <div className="flex items-start gap-2">
          <Checkbox
            id="raw-key-ack"
            checked={acknowledged}
            onCheckedChange={checked => setAcknowledged(checked === true)}
            className="mt-0.5"
          />
          <Label htmlFor="raw-key-ack" className="flex flex-col gap-0.5 font-normal">
            {t('apiKeys.iveCopied')}
            <span className="text-xs font-normal text-muted-foreground">{t('apiKeys.cannotBeShownAgain')}</span>
          </Label>
        </div>

        <div className="flex justify-end">
          <Button onClick={onDismiss} disabled={!acknowledged}>
            {t('common.done')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
