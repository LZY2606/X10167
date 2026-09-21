<script lang="ts">
	import { superForm } from '$lib/client/index.js';
	import type { PageData } from './$types.js';

	let { data }: { data: PageData } = $props();

	const { form, errors, message, enhance, reset } = superForm(data.formA, {
		id: 'formA',
		dataType: 'json'
	});

	const {
		form: formB,
		errors: errorsB,
		message: messageB,
		enhance: enhanceB
	} = superForm(data.formB, { id: 'formB' });

	const addItem = () => ($form.items = [...$form.items, { label: '' }]);
	const removeItem = (index: number) =>
		($form.items = $form.items.filter((_, itemIndex) => itemIndex !== index));
</script>

<h1>Verify smoke</h1>

<form method="POST" action="?/formA" use:enhance data-testid="form-a">
	{#if $message}<p data-testid="message-a">{$message}</p>{/if}
	<label>
		Name
		<input name="name" data-testid="name-a" bind:value={$form.name} />
	</label>
	{#if $errors.name}<p data-testid="error-name-a">{$errors.name}</p>{/if}

	<ul data-testid="items">
		{#each $form.items as item, index (index)}
			<li>
				<input name="items[{index}].label" data-testid="item-input" bind:value={item.label} />
				{#if $errors.items?.[index]?.label}
					<span data-testid="item-error">{$errors.items?.[index]?.label}</span>
				{/if}
				<button type="button" data-testid="remove-item" onclick={() => removeItem(index)}>
					Remove
				</button>
			</li>
		{/each}
	</ul>
	{#if $errors.items?._errors}<p data-testid="error-items-a">{$errors.items._errors}</p>{/if}

	<button type="button" data-testid="add-item" onclick={addItem}>Add item</button>
	<button type="button" data-testid="reset-a" onclick={() => reset()}>Reset</button>
	<button type="submit" data-testid="submit-a">Submit A</button>
</form>

<form method="POST" action="?/formB" use:enhanceB data-testid="form-b">
	{#if $messageB}<p data-testid="message-b">{$messageB}</p>{/if}
	<label>
		Email
		<input name="email" type="email" data-testid="email-b" bind:value={$formB.email} />
	</label>
	{#if $errorsB.email}<p data-testid="error-email-b">{$errorsB.email}</p>{/if}
	<button type="submit" data-testid="submit-b">Submit B</button>
</form>
