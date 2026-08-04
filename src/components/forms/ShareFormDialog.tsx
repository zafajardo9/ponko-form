import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'
import {
  changeCollaboratorRole,
  getCollaborationLogs,
  getCollaborators,
  inviteCollaborator,
  removeCollaborator,
} from '../../lib/server-fns/collaborators'

export function ShareFormDialog({
  formId,
  title,
  open,
  onClose,
}: {
  formId: number
  title: string
  open: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const collaboratorsKey = ['form-collaborators', formId]
  const logsKey = ['collaboration-logs', formId]
  const collaborators = useQuery({
    queryKey: collaboratorsKey,
    queryFn: () => getCollaborators({ data: { formId } }),
    enabled: open,
  })
  const logs = useQuery({
    queryKey: logsKey,
    queryFn: () => getCollaborationLogs({ data: { formId } }),
    enabled: open,
  })
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: collaboratorsKey }),
    queryClient.invalidateQueries({ queryKey: logsKey }),
    queryClient.invalidateQueries({ queryKey: ['forms'] }),
  ])
  const invite = useMutation({
    mutationFn: () => inviteCollaborator({ data: { formId, email, role } }),
    onSuccess: async () => {
      setEmail('')
      await refresh()
    },
  })
  const changeRole = useMutation({
    mutationFn: (data: { collaboratorId: number; role: 'editor' | 'viewer' }) =>
      changeCollaboratorRole({ data }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (collaboratorId: number) => removeCollaborator({ data: { collaboratorId } }),
    onSuccess: refresh,
  })

  if (!open) return null
  const error = invite.error || changeRole.error || remove.error || collaborators.error || logs.error

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="share-form-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e6dfd8] bg-white shadow-[0_24px_70px_rgba(20,20,19,0.24)]">
        <header className="sticky top-0 flex items-start justify-between border-b border-[#ece6de] bg-white px-6 py-5">
          <div>
            <h2 id="share-form-title" className="text-lg font-semibold text-[#282622]">Share “{title}”</h2>
            <p className="mt-1 text-sm text-[#817d76]">Give another PonkoForm user editing or viewing access.</p>
          </div>
          <button type="button" aria-label="Close sharing dialog" onClick={onClose} className="rounded-lg p-2 text-[#817d76] hover:bg-[#f5f0e8]"><X size={18} /></button>
        </header>

        <div className="space-y-7 p-6">
          <form onSubmit={(event) => { event.preventDefault(); invite.mutate() }}>
            <label htmlFor="collaborator-email" className="text-sm font-medium text-[#3d3d3a]">Add collaborator</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input id="collaborator-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="h-11 min-w-0 flex-1 rounded-lg border border-[#d9d2ca] px-3 text-sm focus:border-[#cc785c] focus:outline-none focus:ring-2 focus:ring-[#cc785c]/20" />
              <select aria-label="Collaborator role" value={role} onChange={(event) => setRole(event.target.value as 'editor' | 'viewer')} className="h-11 rounded-lg border border-[#d9d2ca] bg-white px-3 text-sm">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" disabled={invite.isPending} className="h-11 rounded-lg bg-[#cc785c] px-5 text-sm font-semibold text-white hover:bg-[#a9583e] disabled:opacity-60">Invite</button>
            </div>
          </form>

          {error ? <p role="alert" className="rounded-lg bg-[#fdf0f0] px-3 py-2 text-sm text-[#b33e35]">{error instanceof Error ? error.message : 'Sharing could not be updated.'}</p> : null}

          <section>
            <h3 className="text-sm font-semibold text-[#3d3d3a]">Collaborators</h3>
            <div className="mt-3 divide-y divide-[#ece6de] rounded-xl border border-[#e6dfd8]">
              {collaborators.isLoading ? <p className="p-4 text-sm text-[#817d76]">Loading collaborators…</p> : null}
              {!collaborators.isLoading && collaborators.data?.length === 0 ? <p className="p-4 text-sm text-[#817d76]">Only you have access.</p> : null}
              {collaborators.data?.map((person) => (
                <div key={person.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#282622]">{person.name || person.email || 'Collaborator'}</p>
                    {person.name && person.email ? <p className="truncate text-xs text-[#817d76]">{person.email}</p> : null}
                  </div>
                  <select aria-label={`Role for ${person.email || person.name || 'collaborator'}`} value={person.role} onChange={(event) => changeRole.mutate({ collaboratorId: person.id, role: event.target.value as 'editor' | 'viewer' })} className="h-9 rounded-lg border border-[#d9d2ca] bg-white px-2 text-sm">
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button type="button" onClick={() => remove.mutate(person.id)} className="text-sm font-medium text-[#b33e35]">Remove</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[#3d3d3a]">Recent activity</h3>
            <ul className="mt-3 space-y-2">
              {logs.data?.length === 0 ? <li className="text-sm text-[#817d76]">No sharing activity yet.</li> : null}
              {logs.data?.map((entry) => (
                <li key={entry.id} className="text-sm leading-5 text-[#6c6a64]">
                  {entry.details || entry.action.replace('_', ' ')}
                  <span className="ml-2 text-xs text-[#9a958d]">{new Date(entry.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  )
}
