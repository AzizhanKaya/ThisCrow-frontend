import { reactive } from 'vue';
import { type User, State } from '@/types';

const user: User = {
	id: '1',
	name: 'aziz',
	username: '333',
	avatar: 'http://localhost:8000/1.jpg',
	state: State.Online,
};

export const state = reactive<{ user: User | null }>({
	user: null,
});
