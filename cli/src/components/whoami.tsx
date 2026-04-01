import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { Spinner } from '@inkjs/ui';
import { fetchProfile, isLoggedIn, getUser, type UserProfile } from '../services/auth.js';

const AMBER = '#ff6b35';

/**
 * Componente Ink para o comando `bugless whoami`.
 * Exibe o perfil do usuário autenticado e o status da API key.
 */
export function Whoami() {
    const { exit } = useApp();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        async function load() {
            // Verificação rápida local antes de consultar o backend
            if (!isLoggedIn()) {
                setLoading(false);
                // Encerra após renderizar o estado "não logado"
                setTimeout(() => exit(), 1500);
                return;
            }

            const data = await fetchProfile();

            if (data) {
                setProfile(data);
            } else {
                // Token pode ter expirado ou backend offline — tenta mostrar dados locais
                const localUser = getUser();
                if (localUser) {
                    setOffline(true);
                    setProfile({ ...localUser, hasApiKey: false });
                }
            }

            setLoading(false);
            setTimeout(() => exit(), 2000);
        }

        load();
    }, [exit]);

    if (loading) {
        return (
            <Box paddingY={1}>
                <Spinner label="Verificando autenticação..." />
            </Box>
        );
    }

    if (!profile) {
        return (
            <Box flexDirection="column" paddingY={1}>
                <Text color="red">{'❌'} Você não está logado.</Text>
                <Text dimColor>{'💡'} Execute <Text color={AMBER} bold>bugless</Text> para fazer login via navegador.</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" paddingY={1}>
            <Text bold color={AMBER}>{'🔍'} Perfil BugLess</Text>
            <Box height={1} />

            <Text>{'👤'} <Text bold>{profile.name}</Text></Text>
            <Text>{'📧'} {profile.email}</Text>
            <Text>
                {'🔑'} API Key:{' '}
                {profile.hasApiKey
                    ? <Text color="green" bold>✅ Configurada</Text>
                    : <Text color="red" bold>❌ Não configurada</Text>
                }
            </Text>

            {!profile.hasApiKey && (
                <Box marginTop={1}>
                    <Text dimColor>
                        {'💡'} Configure sua API Key em:{' '}
                        <Text color={AMBER}>https://bugless.com.br/dashboard/settings/api-keys</Text>
                    </Text>
                </Box>
            )}

            {offline && (
                <Box marginTop={1}>
                    <Text color="yellow">{'⚠️'} Dados offline (backend indisponível)</Text>
                </Box>
            )}
        </Box>
    );
}
