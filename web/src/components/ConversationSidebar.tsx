import { ActionIcon, Button, Group, Modal, NavLink, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { IconSearch, IconTrash } from '@tabler/icons-react';
import type { Conversation } from '../api.ts';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
dayjs.locale('pt-br');

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  onSelect,
  onCreate,
  onDelete,
}: ConversationSidebarProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((conv) =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setPendingDeleteId(id);
    open();
  }

  function handleConfirmDelete() {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
    }
    setPendingDeleteId(null);
    close();
  }

  function handleCancelDelete() {
    setPendingDeleteId(null);
    close();
  }

  return (
    <>
      <Stack h="100%" gap={0} p="sm">
        <Button fullWidth mb="sm" variant="light" onClick={onCreate}>
          + Nova Conversa
        </Button>

        <TextInput
          placeholder="Buscar conversas..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          mb="sm"
          size="xs"
        />

        <ScrollArea style={{ flex: 1 }}>
          {filteredConversations.length === 0 ? (
            <Text c="dimmed" size="xs" ta="center" mt="md">
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </Text>
          ) : (
            filteredConversations.map((conv) => (
              <NavLink
                key={conv.id}
                label={
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={0} style={{ flex: 1 }}>
                      <Text size="sm" truncate>
                        {conv.title}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {dayjs(conv.createdAt).fromNow()}
                      </Text>
                    </Stack>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={(e) => handleDeleteClick(e, conv.id)}
                      aria-label={`Apagar ${conv.title}`}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                }
                active={conv.id === activeConversationId}
                onClick={() => onSelect(conv.id)}
                style={{ borderRadius: 4, marginBottom: 2 }}
              />
            ))
          )}
        </ScrollArea>
      </Stack>

      <Modal
        opened={opened}
        onClose={handleCancelDelete}
        title="Apagar conversa"
        centered
        size="sm"
      >
        <Text size="sm" mb="md">
          Tem certeza que deseja apagar esta conversa? Esta ação não pode ser desfeita.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleCancelDelete}>
            Cancelar
          </Button>
          <Button color="red" onClick={handleConfirmDelete}>
            Apagar
          </Button>
        </Group>
      </Modal>
    </>
  );
}
