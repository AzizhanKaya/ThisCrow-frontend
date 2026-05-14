<script setup lang="ts">
	import MemberItem from '@/components/Server/Member.vue';
	import type { id, Member, Role } from '@/types';
	import { computed } from 'vue';

	const props = defineProps<{ members: Map<id, Member> }>();

	const getHighestRole = (roles: Role[]): Role | undefined => {
		if (!roles || roles.length === 0) return undefined;
		return roles.reduce((highest, current) => (current.position > highest.position ? current : highest));
	};

	const sortedMembers = computed(() => {
		return Array.from(props.members.values()).sort((a, b) => {
			const aMax = getHighestRole(a.roles)?.position || 0;
			const bMax = getHighestRole(b.roles)?.position || 0;
			if (aMax !== bMax) return bMax - aMax;
			return a.user.name.localeCompare(b.user.name);
		});
	});

	const roleGroups = computed(() => {
		const groups = new Map<string, number>();
		sortedMembers.value.forEach((m) => {
			const name = getHighestRole(m.roles)?.name || 'Members';
			groups.set(name, (groups.get(name) || 0) + 1);
		});
		return groups;
	});

	const isFirstInGroup = (index: number) => {
		if (index === 0) return true;
		const currentRole = getHighestRole(sortedMembers.value[index].roles)?.name || 'Members';
		const prevRole = getHighestRole(sortedMembers.value[index - 1].roles)?.name || 'Members';
		return currentRole !== prevRole;
	};

	const getGroupName = (member: Member) => {
		return getHighestRole(member.roles)?.name || 'Members';
	};
</script>

<template>
	<div class="rightbar">
		<template v-for="(member, index) in sortedMembers" :key="member.user.id.toString()">
			<h4 v-if="isFirstInGroup(index)" class="group-title">
				{{ getGroupName(member) }} - {{ roleGroups.get(getGroupName(member)) }}
			</h4>
			<MemberItem :member="member" />
		</template>
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

	.group-title {
		text-transform: uppercase;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 8px;
		margin-top: 16px;
		padding-left: 8px;
	}

	.group-title:first-of-type {
		margin-top: 0;
	}
</style>
