import { ActionIcon, Button, Group, Modal, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import type { Conversation } from '../api.ts';

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

        <ScrollArea style={{ flex: 1 }}>
          {conversations.length === 0 ? (
            <Text c="dimmed" size="xs" ta="center" mt="md">
              Nenhuma conversa ainda
            </Text>
          ) : (
            conversations.map((conv) => (
              <NavLink
                key={conv.id}
                label={
                  <Group justify="space-between" wrap="nowrap">
                    <Text size="sm" truncate style={{ flex: 1 }}>
                      {conv.title}
                    </Text>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={(e) => handleDeleteClick(e, conv.id)}
                      aria-label={`Apagar ${conv.title}`}
                    >
                      ✕
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
