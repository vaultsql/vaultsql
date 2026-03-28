import { Disclosure } from '@headlessui/react'
import {
  ChevronDownIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/20/solid'
import { UsersIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/catalyst/badge'
import { Button } from '@/components/catalyst/button'
import { Divider } from '@/components/catalyst/divider'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from '@/components/catalyst/dropdown'
import { Text } from '@/components/catalyst/text'
import { UserAvatar } from '@/components/UserAvatar'
import { type GroupWithMembers, type User, useAddMember, useRemoveMember } from '@/queries/groups'

interface GroupCardProps {
  group: GroupWithMembers
  allUsers: User[]
  onEdit: (group: GroupWithMembers) => void
  onDelete: (group: GroupWithMembers) => void
  isExpanded?: boolean
}

export function GroupCard({ group, allUsers, onEdit, onDelete, isExpanded = false }: GroupCardProps) {
  const addMember = useAddMember()
  const removeMember = useRemoveMember()

  const members = group.members ?? []
  const availableUsers = allUsers.filter((user) => !members.some((member) => member.id === user.id))

  const displayedAvatars = members.slice(0, 4)
  const remainingCount = Math.max(0, members.length - displayedAvatars.length)

  return (
    <Disclosure defaultOpen={isExpanded}>
      {({ open }) => (
        <div className="rounded-2xl border border-zinc-950/10 bg-white/80 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/70">
          <div className="px-6 py-5">
            <div className="flex items-center justify-between gap-6">
              <Disclosure.Button className="group flex flex-1 items-center gap-4 text-left">
                <span className="mt-0.5 rounded-full border border-zinc-950/10 bg-zinc-950/5 p-2 text-zinc-600 transition group-hover:bg-zinc-950/10 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                  <UserGroupIcon className="size-4" />
                </span>
                <span className="text-base font-semibold text-zinc-950 dark:text-white">
                  {group.name}
                </span>
                <Badge color="zinc">{members.length} members</Badge>
                <div className="flex items-center gap-2">
                  {displayedAvatars.map((member) => (
                    <UserAvatar key={member.id} user={member} className="size-7" />
                  ))}
                  {remainingCount > 0 && (
                    <Text className="text-xs text-zinc-500">+{remainingCount}</Text>
                  )}
                </div>
              </Disclosure.Button>
              <div className="flex items-center gap-2">
                <Button plain onClick={() => onEdit(group)}>
                  <PencilSquareIcon data-slot="icon" className="size-4" />
                </Button>
                <Button plain onClick={() => onDelete(group)}>
                  <TrashIcon data-slot="icon" className="size-4 text-red-500" />
                </Button>
                <Disclosure.Button className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-950/5 dark:hover:bg-white/5">
                  <ChevronDownIcon
                    className={`size-5 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </Disclosure.Button>
              </div>
            </div>
          </div>
          <Disclosure.Panel className="px-6 pb-6">
            <Divider soft />
            <div className="mt-5 space-y-4">
              <div>
                <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Members
                </Text>
                {members.length === 0 ? (
                  <div className="mt-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-950/20 bg-zinc-50/50 py-8 dark:border-white/15 dark:bg-zinc-900/30">
                    <div className="mb-3 rounded-full bg-zinc-100 p-2.5 dark:bg-zinc-800">
                      <UsersIcon className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                    </div>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                      No members yet. Add team members to grant them access through this group.
                    </Text>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between rounded-xl border border-zinc-950/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-zinc-900/60"
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar user={member} className="size-7" />
                          <div>
                            <div className="text-sm font-medium text-zinc-950 dark:text-white">
                              {member.name || member.email}
                            </div>
                            {member.name && (
                              <div className="text-xs text-zinc-500">{member.email}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          plain
                          onClick={() =>
                            removeMember.mutate({ groupId: group.id, userId: member.id })
                          }
                          disabled={removeMember.isPending}
                        >
                          <XMarkIcon data-slot="icon" className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-dashed border-zinc-950/20 bg-zinc-950/2 p-3 dark:border-white/15 dark:bg-white/5">
                {availableUsers.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Dropdown>
                      <DropdownButton outline>
                        <PlusIcon data-slot="icon" />
                        Add member
                      </DropdownButton>
                      <DropdownMenu>
                        {availableUsers.map((user) => (
                          <DropdownItem
                            key={user.id}
                            onClick={() => addMember.mutate({ groupId: group.id, userId: user.id })}
                          >
                            <div className="flex items-center gap-2">
                              <UserAvatar user={user} className="size-6" />
                              <div>
                                <div className="text-sm">{user.name || user.email}</div>
                                {user.name && (
                                  <div className="text-xs text-zinc-500">{user.email}</div>
                                )}
                              </div>
                            </div>
                          </DropdownItem>
                        ))}
                      </DropdownMenu>
                    </Dropdown>
                    {addMember.isPending && (
                      <Text className="text-sm text-zinc-500">Adding...</Text>
                    )}
                  </div>
                ) : (
                  <Text className="text-sm text-zinc-500">
                    Everyone in the workspace is already in this group.
                  </Text>
                )}
              </div>
            </div>
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  )
}
