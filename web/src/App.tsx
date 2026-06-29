import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Chip,
  Collapse,
  Code,
  CopyButton,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  useMantineColorScheme,
  Burger,
  Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Component, useState, useRef } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { IconDatabase, IconMoon, IconSun, IconChartBar, IconCopy, IconDownload, IconFileExport, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { VegaLite } from 'react-vega';
import { ConversationSidebar } from './components/ConversationSidebar.tsx';
import { useConversations } from './hooks/useConversations.ts';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useDisclosure } from '@mantine/hooks';

class ChartErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  componentDidCatch(e: Error, info: ErrorInfo) {
    console.error('VegaLite render error:', e, info);
  }
  render() {
    if (this.state.error) {
      return <Text size="xs" c="red">Erro ao renderizar gráfico: {this.state.error}</Text>;
    }
    return this.props.children;
  }
}

export function App() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const [opened, { toggle }] = useDisclosure();
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
  const [expandedSql, setExpandedSql] = useState<Record<string, boolean>>({});
  const chartRefs = useRef<Record<string, any>>({});

  function handleExportChart(turnId: string) {
    const view = chartRefs.current[turnId];
    if (view) {
      view.toImageURL('png').then((url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = `aurora-chart-${turnId}.png`;
        link.click();
        notifications.show({
          title: 'Gráfico exportado',
          message: 'O gráfico foi baixado com sucesso',
          color: 'green',
        });
      });
    }
  }

  async function handleSend(question: string) {
    const q = question.trim();
    if (q.length < 3 || loading || !activeConversationId) return;
    setInput('');
    await send(q);
  }

  const isEmpty = turns.length === 0 && !loading;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <IconDatabase size={28} color={colorScheme === 'dark' ? '#60a5fa' : '#3b82f6'} />
            <div>
              <Title order={3} style={{ lineHeight: 1 }}>Aurora</Title>
              <Text c="dimmed" size="xs" hiddenFrom="xs">
                Mortalidade Neonatal Segunda a OMS
              </Text>
            </div>
          </Group>
          <Tooltip label={colorScheme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
            <ActionIcon
              variant="subtle"
              color={colorScheme === 'dark' ? 'yellow' : 'blue'}
              onClick={() => toggleColorScheme()}
              aria-label="Alternar tema"
            >
              {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={(id) => {
            switchConversation(id);
            toggle();
          }}
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
              <Stack align="center" gap="sm" mt="xl">
                <IconChartBar size={48} color={colorScheme === 'dark' ? '#60a5fa' : '#3b82f6'} opacity={0.5} />
                <Text c="dimmed" ta="center" size="lg" fw={500}>
                  Pergunte sobre as taxas de mortalidade neonatal
                </Text>
                <Text c="dimmed" ta="center" size="sm">
                  Exemplos de perguntas:
                </Text>
                <Stack gap="xs" style={{ maxWidth: 400 }}>
                  {[
                    'Qual foi a taxa de mortalidade neonatal do Brasil em 2000?',
                    'Compare a mortalidade neonatal entre Brasil e Argentina',
                    'Quais países tiveram maior redução na mortalidade entre 2000 e 2017?',
                  ].map((example) => (
                    <Chip
                      key={example}
                      variant="light"
                      size="sm"
                      onClick={() => handleSend(example)}
                      checked={false}
                      style={{ justifyContent: 'flex-start' }}
                    >
                      {example}
                    </Chip>
                  ))}
                </Stack>
              </Stack>
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
                    <Group justify="flex-end" mb="xs">
                      <Menu shadow="md" width={200}>
                        <Menu.Target>
                          <Button size="xs" variant="light" leftSection={<IconDownload size={14} />}>
                            Exportar
                          </Button>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconFileExport size={14} />}
                            onClick={() => handleExportChart(turn.id)}
                          >
                            Exportar como PNG
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                    <ChartErrorBoundary>
                      <VegaLite
                        spec={turn.vegaSpec as never}
                        actions={false}
                        onNewView={(view) => {
                          chartRefs.current[turn.id] = view;
                        }}
                      />
                    </ChartErrorBoundary>
                  </div>
                )}

                {turn.attribution && (
                  <Badge color="gray" variant="light" mt="sm" style={{ textTransform: 'none' }}>
                    {turn.attribution}
                  </Badge>
                )}

                {turn.query && (
                  <Paper mt="sm" p="xs" withBorder bg="gray.0">
                    <Group justify="space-between" mb="xs">
                      <Text size="xs" fw={500} c="dimmed">
                        Query SQL gerada
                      </Text>
                      <Group gap="xs">
                        <CopyButton value={turn.query}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Copiado!' : 'Copiar SQL'}>
                              <ActionIcon size="xs" variant="subtle" onClick={copy}>
                                <IconCopy size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          onClick={() => setExpandedSql((prev) => ({ ...prev, [turn.id]: !prev[turn.id] }))}
                        >
                          {expandedSql[turn.id] ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                        </ActionIcon>
                      </Group>
                    </Group>
                    <Collapse in={expandedSql[turn.id]}>
                      <Code block style={{ fontSize: 12 }}>
                        {turn.query}
                      </Code>
                    </Collapse>
                  </Paper>
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
              <Paper p="md" withBorder bg="blue.0">
                <Group gap="sm">
                  <Loader size="sm" color="blue" />
                  <Stack gap={0}>
                    <Text size="sm" fw={500} c="blue">
                      Processando sua pergunta…
                    </Text>
                    <Text size="xs" c="dimmed">
                      Aurora está consultando os dados da OMS e gerando a análise.
                    </Text>
                  </Stack>
                </Group>
              </Paper>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
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
