<script setup lang="ts">
	import MemberItem from '@/components/Server/Member.vue';
	import type { id, Member, Role } from '@/types';
	import { computed } from 'vue';
	import { useServerStore } from '@/stores/server';
	import { useRoute } from 'vue-router';

	const props = defineProps<{ members: Map<id, Member> }>();

	const membersByRole = computed(() => {
		const getHighestRole = (roles: Role[]): Role | undefined => {
			if (!roles || roles.length === 0) return undefined;
			return roles.reduce((highest, current) => (current.position > highest.position ? current : highest));
		};

		const sortedMembers = Array.from(props.members.values()).sort((a, b) => {
			const aMax = getHighestRole(a.roles)?.position || 0;
			const bMax = getHighestRole(b.roles)?.position || 0;
			return bMax - aMax;
		});

		const res = new Map<string, { title: string; members: Member[] }>();

		sortedMembers.forEach((member) => {
			const highestRole = getHighestRole(member.roles);
			const roleName = highestRole?.name || 'Members';

			if (!res.has(roleName)) {
				res.set(roleName, { title: roleName, members: [] });
			}

			res.get(roleName)!.members.push(member);
		});

		return res;
	});
</script>

<template>
	<div class="rightbar">
		<div class="member-group" v-for="[roleName, group] in membersByRole" :key="roleName">
			<h4>{{ group.title }} - {{ group.members.length }}</h4>
			<MemberItem v-for="member in group.members" :key="member.user.id.toString()" :member="member" />
		</div>
	</div>
</template>

<style scoped>
	.rightbar {
		border-left: 1px solid var(--border);
		display: flex;
		flex-direction: column;
		padding: 16px 8px;
		overflow-x: hidden;
		overflow-y: auto;
	}

	.member-group h4 {
		text-transform: uppercase;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 8px;
		margin-top: 16px;
		padding-left: 8px;
	}

	.member-group:first-child h4 {
		margin-top: 0;
	}

	.member-item {
		display: flex;
		align-items: center;

		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		margin-right: 12px;
		background-color: var(--bg);
		object-fit: cover;
	}

	.member-name {
		color: var(--text-muted);
		font-weight: 500;
	}

	.member-item:hover .member-name {
		color: var(--text);
	}
</style>
