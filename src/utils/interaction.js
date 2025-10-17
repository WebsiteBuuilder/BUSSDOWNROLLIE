import { logger } from '../logger.js';

export function alreadyAcked(interaction) {
  return Boolean(interaction?.replied || interaction?.deferred);
}

export async function safeReply(interaction, payload) {
  try {
    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (err) {
    // last resort to ensure ack
    if (!(interaction.replied || interaction.deferred)) {
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch {}
    }
    throw err;
  }
}

export async function safeUpdate(interaction, payload) {
  if (interaction.isMessageComponent?.()) {
    if (!interaction.deferred && !interaction.replied) {
      return interaction.update(payload);
    }

    if (interaction.deferred && interaction.editReply) {
      return interaction.editReply(payload);
    }
  }

  if (interaction.deferred && interaction.editReply) {
    return interaction.editReply(payload);
  }

  return safeReply(interaction, payload);
}

export async function ackButton(i) {
  try {
    if (!i.deferred && !i.replied) {
      await i.deferUpdate(); // immediate ACK to avoid “Interaction Failed”
    }
  } catch (e) {
    // If update fails (e.g., message deleted), try an ephemeral reply so we still ACK
    if (!i.replied) {
      try {
        await i.reply({ ephemeral: true, content: 'Processing…' });
      } catch {}
    }
  }
}

export function ackWithin3s(interaction, context = {}) {
  const started = Date.now();
  let finished = false;

  const warningTimeout = setTimeout(() => {
    if (!finished && !alreadyAcked(interaction)) {
      logger.warn('interaction ack exceeding 2s', {
        ...context,
        id: interaction.id,
        user: interaction.user?.id,
      });
    }
  }, 2000);

  warningTimeout.unref?.();

  return () => {
    if (finished) return;
    finished = true;
    clearTimeout(warningTimeout);
    const elapsed = Date.now() - started;
    if (elapsed > 2000) {
      logger.warn('interaction ack latency', {
        ...context,
        id: interaction.id,
        user: interaction.user?.id,
        elapsed,
      });
    }
  };
}
