import { useState } from 'react';
import {
  AppShell,
  Container,
  ScrollArea,
  TextInput,
  Button,
  Group,
  Stack,
  Paper,
  Text,
  Title,
  Loader,
  Badge,
  Chip,
} from '@mantine/core';
import { VegaLite } from 'react-vega';
import { askQuestion, type ChatResponse } from './api.ts';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
  attribution?: string | null;
  vegaSpec?: object | null;
  followUps?: string[];
}

export function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send(question: string) {
    const q = question.trim();
    if (q.length < 3 || loading) return;
    setInput('');
    setTurns((t) => [...t, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res: ChatResponse = await askQuestion(q);
      setTurns((t) => [
        ...t,
        {
          role: 'assistant',
          text: res.answer,
          attribution: res.attribution,
          vegaSpec: res.vegaSpec,
          followUps: res.followUpQuestions,
        },
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: 'Desculpe, algo deu errado. Por favor, tente novamente.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>🌅 Aurora</Title>
          <Text c="dimmed" size="sm">
            Mortalidade Neonatal da OMS — analista Text-to-SQL
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm">
          <ScrollArea h="calc(100vh - 200px)" type="auto">
            <Stack gap="md" pb="md">
              {turns.length === 0 && (
                <Text c="dimmed" ta="center" mt="xl">
                  Pergunte sobre as taxas de mortalidade neonatal por país e ano — ex.: “Qual foi a
                  taxa de mortalidade neonatal do Brasil em 2000?”
                </Text>
              )}
              {turns.map((turn, i) => (
                <Paper
                  key={i}
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
                      <VegaLite spec={turn.vegaSpec as any} actions={false} />
                    </div>
                  )}

                  {turn.attribution && (
                    <Badge color="gray" variant="light" mt="sm" style={{ textTransform: 'none' }}>
                      {turn.attribution}
                    </Badge>
                  )}

                  {turn.followUps && turn.followUps.length > 0 && (
                    <Group gap="xs" mt="sm">
                      {turn.followUps.map((fu, j) => (
                        <Chip
                          key={j}
                          size="xs"
                          variant="light"
                          onClick={() => send(fu)}
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
              send(input);
            }}
          >
            <Group mt="md" gap="xs" align="flex-end">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Faça uma pergunta sobre os dados de mortalidade neonatal da OMS…"
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                disabled={loading}
              />
              <Button type="submit" disabled={loading || input.trim().length < 3}>
                Enviar
              </Button>
            </Group>
          </form>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
