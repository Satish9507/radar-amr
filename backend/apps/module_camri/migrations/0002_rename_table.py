from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('module_camri', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='CAMRICoefficient',
            table='amr_coefficients',
        ),
    ]
