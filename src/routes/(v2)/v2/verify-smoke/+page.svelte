<script lang="ts">
	import { superForm } from '$lib/client/index.js';

	export let data;

	const {
		form: formA,
		errors: errorsA,
		message: messageA,
		enhance: enhanceA,
		reset: resetA
	} = superForm(data.formA, { dataType: 'json' });

	const {
		form: formB,
		errors: errorsB,
		message: messageB,
		enhance: enhanceB
	} = superForm(data.formB);
</script>

<h2>Form A</h2>
{#if $messageA}<p data-testid="message-a">{$messageA}</p>{/if}
<form method="POST" action="?/formA" use:enhanceA>
	<label>
		Name <input name="name" data-testid="name-a" bind:value={$formA.name} />
	</label>
	{#if $errorsA.name}<span data-testid="error-name-a">{$errorsA.name}</span>{/if}

	{#each $formA.tags as _tag, i}
		<div data-testid="tag-row">
			<input data-testid="tag-{i}" bind:value={$formA.tags[i]} />
			<button
				type="button"
				data-testid="remove-tag-{i}"
				on:click={() => ($formA.tags = $formA.tags.filter((_, j) => j !== i))}>Remove</button
			>
		</div>
	{/each}
	<button type="button" data-testid="add-tag" on:click={() => ($formA.tags = [...$formA.tags, ''])}
		>Add tag</button
	>
	<button type="button" data-testid="reset-a" on:click={() => resetA()}>Reset</button>
	<button data-testid="submit-a">Submit A</button>
</form>

<h2>Form B</h2>
{#if $messageB}<p data-testid="message-b">{$messageB}</p>{/if}
<form method="POST" action="?/formB" use:enhanceB>
	<label>
		City <input name="city" data-testid="city-b" bind:value={$formB.city} />
	</label>
	{#if $errorsB.city}<span data-testid="error-city-b">{$errorsB.city}</span>{/if}
	<button data-testid="submit-b">Submit B</button>
</form>
