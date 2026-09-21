<script lang="ts">
	import { page } from '$app/stores';
	import { superForm } from '$lib/client/index.js';
	import { zodClient } from '$lib/adapters/zod.js';
	import { noteSchema, userSchema } from './schema.js';

	export let data;

	const userForm = superForm(data.userForm, {
		validators: zodClient(userSchema),
		dataType: 'json',
		resetForm: false,
		invalidateAll: false,
		taintedMessage: false
	});
	const {
		form: user,
		errors: userErrors,
		message: userMessage,
		enhance: userEnhance,
		reset: userReset
	} = userForm;

	const noteForm = superForm(data.noteForm, {
		validators: zodClient(noteSchema),
		taintedMessage: false
	});
	const { form: note, errors: noteErrors, message: noteMessage, enhance: noteEnhance } = noteForm;

	function addTag() {
		$user.tags = [...$user.tags, ''];
	}

	function removeTag(index: number) {
		$user.tags = $user.tags.filter((_, i) => i !== index);
	}
</script>

<h3>verify-smoke: user form</h3>

{#if $userMessage}
	<div
		data-testid="user-message"
		class="status"
		class:error={$page.status >= 400}
		class:success={$page.status == 200}
	>
		{$userMessage}
	</div>
{/if}

<form method="POST" action="?/user" use:userEnhance>
	<label>
		Name<br />
		<input
			name="name"
			data-testid="user-name"
			aria-invalid={$userErrors.name ? 'true' : undefined}
			bind:value={$user.name}
		/>
		{#if $userErrors.name}<span data-testid="user-name-error" class="invalid"
				>{$userErrors.name}</span
			>{/if}
	</label>

	<label>
		Email<br />
		<input
			name="email"
			type="email"
			data-testid="user-email"
			aria-invalid={$userErrors.email ? 'true' : undefined}
			bind:value={$user.email}
		/>
		{#if $userErrors.email}<span data-testid="user-email-error" class="invalid"
				>{$userErrors.email}</span
			>{/if}
	</label>

	<fieldset>
		<legend>Tags</legend>
		{#each $user.tags as tag, i}
			<div>
				<input data-testid="user-tag-{i}" bind:value={tag} />
				<button
					type="button"
					data-testid="remove-tag-{i}"
					on:click|preventDefault={() => removeTag(i)}>Remove</button
				>
			</div>
		{/each}
		<button type="button" data-testid="add-tag" on:click|preventDefault={addTag}>Add tag</button>
	</fieldset>

	<button type="button" data-testid="user-reset" on:click|preventDefault={() => userReset()}
		>Reset</button
	>
	<button data-testid="user-submit">Submit user</button>
</form>

<hr />

<h3>verify-smoke: note form</h3>

{#if $noteMessage}
	<div
		data-testid="note-message"
		class="status"
		class:error={$page.status >= 400}
		class:success={$page.status == 200}
	>
		{$noteMessage}
	</div>
{/if}

<form method="POST" action="?/note" use:noteEnhance>
	<label>
		Title<br />
		<input
			name="title"
			data-testid="note-title"
			aria-invalid={$noteErrors.title ? 'true' : undefined}
			bind:value={$note.title}
		/>
		{#if $noteErrors.title}<span data-testid="note-title-error" class="invalid"
				>{$noteErrors.title}</span
			>{/if}
	</label>

	<button data-testid="note-submit">Submit note</button>
</form>

<style>
	.invalid {
		color: red;
	}

	.status {
		color: white;
		padding: 4px;
		padding-left: 8px;
		border-radius: 2px;
		font-weight: 500;
	}

	.status.success {
		background-color: seagreen;
	}

	.status.error {
		background-color: #ff2a02;
	}
</style>
