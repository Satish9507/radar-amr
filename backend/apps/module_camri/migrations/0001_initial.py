from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='CAMRICoefficient',
            fields=[
                ('id',               models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type',             models.CharField(choices=[('arb', 'ARB'), ('arg', 'ARG')], db_index=True, max_length=3)),
                ('column_name',      models.CharField(max_length=50, unique=True)),
                ('label',            models.CharField(max_length=150)),
                ('coefficient',      models.FloatField()),
                ('priority_rank',    models.PositiveSmallIntegerField(default=1)),
                ('source_reference', models.CharField(blank=True, max_length=200)),
                ('sort_order',       models.PositiveSmallIntegerField(default=0)),
            ],
            options={
                'ordering': ['type', 'sort_order', '-coefficient'],
            },
        ),
    ]
