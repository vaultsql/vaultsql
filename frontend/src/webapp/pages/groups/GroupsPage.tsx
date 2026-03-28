import { ChevronDownIcon, PlusIcon, UserMinusIcon, UserPlusIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { Button } from '@/components/catalyst/button'
import { Divider } from '@/components/catalyst/divider'
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from '@/components/catalyst/dropdown'
import { Heading, Subheading } from '@/components/catalyst/heading'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/catalyst/table'
import { Text } from '@/components/catalyst/text'
import { UserAvatar } from '@/components/UserAvatar'
import {
  type GroupWithMembers,
  useCreateGroup,
  useDeleteGroup,
  useGroupsWithMembers,
  useRemoveUser,
  useUpdateGroup,
  useUpdateUserRole,
  useUsers,
} from '@/queries/groups'
import { useUser } from '@/queries/user'
import { usePageTitle } from '@/webapp/hooks'
import { DeleteGroupDialog } from './DeleteGroupDialog'
import { GroupCard } from './GroupCard'
import { GroupFormDialog } from './GroupFormDialog'
import { InviteMembersDialog } from './InviteMembersDialog'
import { RemoveMemberDialog } from './RemoveMemberDialog'
import type { User } from '@/queries/groups'

export function GroupsPage() {
  usePageTitle('Groups & Members')
  const { data: groups = [], isLoading, error } = useGroupsWithMembers()
  const { data: users = [] } = useUsers()
  const { data: currentUser } = useUser()
  const currentUserId = currentUser?.user?.id
  const createGroup = useCreateGroup()
  const updateGroup = useUpdateGroup()
  const deleteGroup = useDeleteGroup()
  const removeUser = useRemoveUser()
  const updateUserRole = useUpdateUserRole()

  const [isCreateOpen, setCreateOpen] = useState(false)
  const [isInviteOpen, setInviteOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<GroupWithMembers | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<GroupWithMembers | null>(null)
  const [removeUserTarget, setRemoveUserTarget] = useState<User | null>(null)
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set())

  const closeCreate = () => {
    setCreateOpen(false)
    createGroup.reset()
  }

  const closeEdit = () => {
    setEditGroup(null)
    updateGroup.reset()
  }

  const closeDelete = () => {
    setDeleteTarget(null)
    deleteGroup.reset()
  }

  const closeRemoveUser = () => {
    setRemoveUserTarget(null)
    removeUser.reset()
  }

  const handleCreateGroup = async ({
    name,
    description,
  }: {
    name: string
    description: string
  }) => {
    try {
      const newGroup = await createGroup.mutateAsync({ name, description })
      // Add the newly created group to expanded set
      setExpandedGroupIds((prev) => new Set(prev).add(newGroup.id))
      closeCreate()
    } catch {
      // Error handled via mutation state.
    }
  }

  const handleUpdateGroup = async ({
    name,
    description,
  }: {
    name: string
    description: string
  }) => {
    if (!editGroup) return
    try {
      await updateGroup.mutateAsync({ groupId: editGroup.id, name, description })
      closeEdit()
    } catch {
      // Error handled via mutation state.
    }
  }

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return
    try {
      await deleteGroup.mutateAsync({ groupId: deleteTarget.id })
      closeDelete()
    } catch {
      // Error handled via mutation state.
    }
  }

  const handleRemoveUser = async () => {
    if (!removeUserTarget) return
    try {
      await removeUser.mutateAsync({ userId: removeUserTarget.id })
      closeRemoveUser()
    } catch {
      // Error handled via mutation state.
    }
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <Heading>Groups</Heading>
        <Text className="mt-2">Loading groups...</Text>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <Heading>Groups</Heading>
        <Text className="mt-2 text-red-600">Error loading groups: {error.message}</Text>
      </div>
    )
  }

  return (
    <div className="space-y-10 p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Heading className="text-3xl/9 sm:text-2xl/9">Groups & members</Heading>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            <span>{groups.length} groups</span>
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
            <span>{users.length} members</span>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Subheading className="text-xl/8 sm:text-lg/8">Groups</Subheading>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-slot="icon" />
            New group
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-zinc-950/20 bg-white/60 p-8 text-center dark:border-white/15 dark:bg-white/5">
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              No groups yet. Create your first group to start organizing approvals.
            </Text>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setCreateOpen(true)}>Create group</Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                allUsers={users}
                onEdit={setEditGroup}
                onDelete={setDeleteTarget}
                isExpanded={expandedGroupIds.has(group.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Subheading className="text-xl/8 sm:text-lg/8">Members</Subheading>
          <Button outline onClick={() => setInviteOpen(true)}>
            <UserPlusIcon data-slot="icon" />
            Invite member
          </Button>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-950/10 bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between">
            <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Workspace roster
            </Text>
            <Text className="text-xs text-zinc-500">{users.length} members</Text>
          </div>
          <Divider className="my-4" soft />
          {users.length === 0 ? (
            <Text className="text-sm text-zinc-500">No members yet.</Text>
          ) : (
            <Table dense striped>
              <TableHead>
                <tr>
                  <TableHeader>Name</TableHeader>
                  <TableHeader>Email</TableHeader>
                  <TableHeader>Role</TableHeader>
                  <TableHeader className="text-right">Actions</TableHeader>
                </tr>
              </TableHead>
              <TableBody>
                {users.map((user) => {
                  const displayName = user.name || user.email
                  const roleLabel = user.role === 'admin' ? 'Admin' : 'Member'
                  const isSelf = user.id === currentUserId
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar user={user} className="size-7" />
                          <span className="text-sm font-medium text-zinc-950 dark:text-white">
                            {displayName}
                          </span>
                          {isSelf && (
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">(you)</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">{user.email}</TableCell>
                      <TableCell>
                        {isSelf ? (
                          <span className="text-sm text-zinc-950 dark:text-white">{roleLabel}</span>
                        ) : (
                          <Dropdown>
                            <DropdownButton plain>
                              <span className="text-sm text-zinc-950 dark:text-white">
                                {roleLabel}
                              </span>
                              <ChevronDownIcon data-slot="icon" />
                            </DropdownButton>
                            <DropdownMenu>
                              <DropdownItem
                                onClick={() =>
                                  updateUserRole.mutate({ userId: user.id, role: 'admin' })
                                }
                              >
                                Admin
                              </DropdownItem>
                              <DropdownItem
                                onClick={() =>
                                  updateUserRole.mutate({ userId: user.id, role: 'member' })
                                }
                              >
                                Member
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isSelf && (
                          <Button plain onClick={() => setRemoveUserTarget(user)}>
                            <UserMinusIcon data-slot="icon" />
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <GroupFormDialog
        open={isCreateOpen}
        title="Create group"
        description="Groups help teams route approvals quickly."
        confirmLabel="Create group"
        isPending={createGroup.isPending}
        errorMessage={createGroup.error?.message ?? null}
        onClose={closeCreate}
        onSubmit={handleCreateGroup}
      />

      <GroupFormDialog
        open={Boolean(editGroup)}
        title="Edit group"
        description="Update the name and description for this group."
        confirmLabel="Save changes"
        initialValues={{
          name: editGroup?.name ?? '',
          description: editGroup?.description ?? '',
        }}
        isPending={updateGroup.isPending}
        errorMessage={updateGroup.error?.message ?? null}
        onClose={closeEdit}
        onSubmit={handleUpdateGroup}
      />

      <DeleteGroupDialog
        open={Boolean(deleteTarget)}
        groupName={deleteTarget?.name}
        isPending={deleteGroup.isPending}
        errorMessage={deleteGroup.error?.message ?? null}
        onClose={closeDelete}
        onConfirm={handleDeleteGroup}
      />

      <InviteMembersDialog open={isInviteOpen} onClose={() => setInviteOpen(false)} />

      <RemoveMemberDialog
        open={Boolean(removeUserTarget)}
        memberName={removeUserTarget?.name || removeUserTarget?.email}
        isPending={removeUser.isPending}
        errorMessage={removeUser.error?.message ?? null}
        onClose={closeRemoveUser}
        onConfirm={handleRemoveUser}
      />
    </div>
  )
}
