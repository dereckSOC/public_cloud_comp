import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@psd/shared/lib/supabaseClient';
import { getCurrentUserRole } from '@psd/shared/lib/authClient';

export function useAuth(activeEventId, pathname) {
    const router = useRouter();
    const [authLoading, setAuthLoading] = useState(true);
    const [userRole, setUserRole] = useState('');
    const [userEmail, setUserEmail] = useState('');

    useEffect(() => {
        let mounted = true;

        const checkAuth = async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session?.user) {
                router.replace(`/login?next=${encodeURIComponent(pathname)}`);
                return;
            }

            try {
                const role = await getCurrentUserRole(session.user.id);
                if (!mounted) return;

                if (role !== 'superadmin' && role !== 'admin') {
                    router.replace('/unauthorized');
                    return;
                }

                if (!activeEventId) {
                    router.replace('/events');
                    return;
                }

                if (role === 'admin') {
                    const { data: assignment, error: assignmentError } = await supabase
                        .from('event_admins')
                        .select('event_id')
                        .eq('user_id', session.user.id)
                        .eq('event_id', activeEventId)
                        .maybeSingle();
                    if (assignmentError) {
                        throw assignmentError;
                    }
                    if (!assignment) {
                        router.replace('/unauthorized');
                        return;
                    }
                }

                setUserRole(role);
                setUserEmail(session.user.email || '');
                setAuthLoading(false);
            } catch (authError) {
                router.replace('/login');
            }
        };

        checkAuth();

        return () => {
            mounted = false;
        };
    }, [activeEventId, pathname, router]);

    return { authLoading, userRole, userEmail };
}
