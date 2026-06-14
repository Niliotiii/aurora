import {
  AppShell,
  Badge,
  Button,
  Chip,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { VegaLite } from 'react-vega';
import { ConversationSidebar } from './components/ConversationSidebar.tsx';
import { useConversations } from './hooks/useConversations.ts';

export function App() {
  const {
    conversations,
    activeConversationId,
    turns,
    loading,
    createConversation,
    switchConversation,
    deleteConversation,
    send,
  } = useConversations();

  const [input, setInput] = useState('');

  async function handleSend(question: string) {
    const q = question.trim();
    if (q.length < 3 || loading || !activeConversationId) return;
    setInput('');
    await send(q);
  }

  const isEmpty = turns.length === 0 && !loading;

  return (
    <AppShell header={{ height: 60 }} navbar={{ width: 260, breakpoint: 'sm' }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>🌅 Aurora</Title>
          <Text c="dimmed" size="sm">
            Mortalidade Neonatal da OMS — analista Text-to-SQL
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={switchConversation}
          onCreate={createConversation}
          onDelete={deleteConversation}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <ScrollArea h="calc(100vh - 140px)" type="auto">
          <Stack gap="md" pb="md">
            {isEmpty && !activeConversationId ? (
              <Text c="dimmed" ta="center" mt="xl">
                Crie uma nova conversa para começar.
              </Text>
            ) : isEmpty ? (
              <Text c="dimmed" ta="center" mt="xl">
                Pergunte sobre as taxas de mortalidade neonatal por país e ano — ex.: "Qual foi a
                taxa de mortalidade neonatal do Brasil em 2000?"
              </Text>
            ) : null}

            {turns.map((turn) => (
              <Paper
                key={turn.id}
                shadow="xs"
                p="md"
                radius="md"
                withBorder
                bg={turn.role === 'user' ? 'blue.0' : undefined}
              >
                <Text size="sm" fw={600} c={turn.role === 'user' ? 'blue' : 'teal'} mb={4}>
                  {turn.role === 'user' ? 'Você' : 'Aurora'}
                </Text>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{turn.text}</Text>

                {turn.vegaSpec && (
                  <div style={{ marginTop: 12 }}>
                    <VegaLite spec={turn.vegaSpec as never} actions={false} />
                  </div>
                )}

                {turn.attribution && (
                  <Badge color="gray" variant="light" mt="sm" style={{ textTransform: 'none' }}>
                    {turn.attribution}
                  </Badge>
                )}

                {turn.followUps && turn.followUps.length > 0 && (
                  <Group gap="xs" mt="sm">
                    {turn.followUps.map((fu) => (
                      <Chip
                        key={fu}
                        size="xs"
                        variant="light"
                        onClick={() => handleSend(fu)}
                        checked={false}
                      >
                        {fu}
                      </Chip>
                    ))}
                  </Group>
                )}
              </Paper>
            ))}

            {loading && (
              <Group>
                <Loader size="sm" />
                <Text c="dimmed" size="sm">
                  Consultando os dados da OMS…
                </Text>
              </Group>
            )}
          </Stack>
        </ScrollArea>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
        >
          <Group mt="md" gap="xs" align="flex-end">
            <TextInput
              style={{ flex: 1 }}
              placeholder="Faça uma pergunta sobre os dados de mortalidade neonatal da OMS…"
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              disabled={loading || !activeConversationId}
            />
            <Button
              type="submit"
              disabled={loading || input.trim().length < 3 || !activeConversationId}
            >
              Enviar
            </Button>
          </Group>
        </form>
      </AppShell.Main>
    </AppShell>
  );
}
